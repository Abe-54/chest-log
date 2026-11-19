namespace Unreal.Encryption;

/// <summary>AES-ECB decryption with PKCS7 unpadding in plain managed code, table driven (inverse cipher with the equivalent key schedule).</summary>
internal static class ManagedAes
{
    static readonly byte[] Sbox = new byte[256];
    static readonly byte[] InvSbox = new byte[256];
    static readonly uint[] Td0 = new uint[256], Td1 = new uint[256], Td2 = new uint[256], Td3 = new uint[256];

    static ManagedAes()
    {
        byte p = 1, q = 1;
        do
        {
            p = (byte)(p ^ (p << 1) ^ ((p & 0x80) != 0 ? 0x1B : 0));
            q ^= (byte)(q << 1);
            q ^= (byte)(q << 2);
            q ^= (byte)(q << 4);
            if ((q & 0x80) != 0) q ^= 0x09;
            var x = (byte)(q ^ Rotl8(q, 1) ^ Rotl8(q, 2) ^ Rotl8(q, 3) ^ Rotl8(q, 4));
            Sbox[p] = (byte)(x ^ 0x63);
        } while (p != 1);
        Sbox[0] = 0x63;
        for (var i = 0; i < 256; i++) InvSbox[Sbox[i]] = (byte)i;
        for (var i = 0; i < 256; i++)
        {
            uint s = InvSbox[i];
            var w = (Mul(s, 0x0e) << 24) | (Mul(s, 0x09) << 16) | (Mul(s, 0x0d) << 8) | Mul(s, 0x0b);
            Td0[i] = w;
            Td1[i] = (w >> 8) | (w << 24);
            Td2[i] = (w >> 16) | (w << 16);
            Td3[i] = (w >> 24) | (w << 8);
        }
    }

    static byte Rotl8(byte x, int s) => (byte)((x << s) | (x >> (8 - s)));

    static uint Mul(uint a, uint b)
    {
        uint r = 0;
        while (b != 0)
        {
            if ((b & 1) != 0) r ^= a;
            a <<= 1;
            if ((a & 0x100) != 0) a ^= 0x11B;
            b >>= 1;
        }
        return r;
    }

    public static byte[] DecryptEcbPkcs7(ReadOnlySpan<byte> key, ReadOnlySpan<byte> data)
    {
        if (key.Length is not (16 or 24 or 32)) throw new ArgumentException("AES key must be 16, 24 or 32 bytes");
        if (data.Length == 0 || data.Length % 16 != 0) throw new ArgumentException("ciphertext must be a non-empty multiple of 16 bytes");
        var rounds = key.Length / 4 + 6;
        var dk = DecryptionKey(key, rounds);
        var output = new byte[data.Length];
        for (var offset = 0; offset < data.Length; offset += 16)
            DecryptBlock(dk, rounds, data.Slice(offset, 16), output.AsSpan(offset, 16));
        var pad = output[^1];
        if (pad is 0 or > 16) throw new InvalidOperationException("invalid PKCS7 padding");
        for (var i = output.Length - pad; i < output.Length; i++)
            if (output[i] != pad) throw new InvalidOperationException("invalid PKCS7 padding");
        return output.AsSpan(0, output.Length - pad).ToArray();
    }

    static uint[] DecryptionKey(ReadOnlySpan<byte> key, int rounds)
    {
        var nk = key.Length / 4;
        var w = new uint[4 * (rounds + 1)];
        for (var i = 0; i < nk; i++)
            w[i] = (uint)(key[4 * i] << 24 | key[4 * i + 1] << 16 | key[4 * i + 2] << 8 | key[4 * i + 3]);
        uint rcon = 1;
        for (var i = nk; i < w.Length; i++)
        {
            var t = w[i - 1];
            if (i % nk == 0)
            {
                t = SubWord((t << 8) | (t >> 24)) ^ (rcon << 24);
                rcon = Mul(rcon, 2);
            }
            else if (nk > 6 && i % nk == 4) t = SubWord(t);
            w[i] = w[i - nk] ^ t;
        }
        var dk = new uint[w.Length];
        for (var round = 0; round <= rounds; round++)
        {
            for (var c = 0; c < 4; c++)
            {
                var word = w[4 * (rounds - round) + c];
                dk[4 * round + c] = round is 0 || round == rounds ? word : InvMixWord(word);
            }
        }
        return dk;
    }

    static uint SubWord(uint w) =>
        (uint)(Sbox[w >> 24] << 24 | Sbox[(w >> 16) & 0xff] << 16 | Sbox[(w >> 8) & 0xff] << 8 | Sbox[w & 0xff]);

    static uint InvMixWord(uint w) =>
        Td0[Sbox[w >> 24]] ^ Td1[Sbox[(w >> 16) & 0xff]] ^ Td2[Sbox[(w >> 8) & 0xff]] ^ Td3[Sbox[w & 0xff]];

    static void DecryptBlock(uint[] dk, int rounds, ReadOnlySpan<byte> input, Span<byte> output)
    {
        var s0 = Load(input, 0) ^ dk[0];
        var s1 = Load(input, 4) ^ dk[1];
        var s2 = Load(input, 8) ^ dk[2];
        var s3 = Load(input, 12) ^ dk[3];
        var k = 4;
        for (var round = 1; round < rounds; round++, k += 4)
        {
            var t0 = Td0[s0 >> 24] ^ Td1[(s3 >> 16) & 0xff] ^ Td2[(s2 >> 8) & 0xff] ^ Td3[s1 & 0xff] ^ dk[k];
            var t1 = Td0[s1 >> 24] ^ Td1[(s0 >> 16) & 0xff] ^ Td2[(s3 >> 8) & 0xff] ^ Td3[s2 & 0xff] ^ dk[k + 1];
            var t2 = Td0[s2 >> 24] ^ Td1[(s1 >> 16) & 0xff] ^ Td2[(s0 >> 8) & 0xff] ^ Td3[s3 & 0xff] ^ dk[k + 2];
            var t3 = Td0[s3 >> 24] ^ Td1[(s2 >> 16) & 0xff] ^ Td2[(s1 >> 8) & 0xff] ^ Td3[s0 & 0xff] ^ dk[k + 3];
            s0 = t0; s1 = t1; s2 = t2; s3 = t3;
        }
        Store(output, 0, Final(s0, s3, s2, s1) ^ dk[k]);
        Store(output, 4, Final(s1, s0, s3, s2) ^ dk[k + 1]);
        Store(output, 8, Final(s2, s1, s0, s3) ^ dk[k + 2]);
        Store(output, 12, Final(s3, s2, s1, s0) ^ dk[k + 3]);
    }

    static uint Final(uint a, uint b, uint c, uint d) =>
        (uint)(InvSbox[a >> 24] << 24 | InvSbox[(b >> 16) & 0xff] << 16 | InvSbox[(c >> 8) & 0xff] << 8 | InvSbox[d & 0xff]);

    static uint Load(ReadOnlySpan<byte> b, int i) => (uint)(b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]);

    static void Store(Span<byte> b, int i, uint v)
    {
        b[i] = (byte)(v >> 24);
        b[i + 1] = (byte)(v >> 16);
        b[i + 2] = (byte)(v >> 8);
        b[i + 3] = (byte)v;
    }
}
