using System.Security.Cryptography;

namespace Unreal.Encryption;

public static class AesEcb
{
    /// <summary>The browser runtime has no <see cref="Aes"/>, so WebAssembly decrypts in managed code. Every other platform keeps the system implementation.</summary>
    public static byte[] DecryptPkcs7(ReadOnlySpan<byte> key, ReadOnlySpan<byte> data)
    {
        if (OperatingSystem.IsBrowser())
            return ManagedAes.DecryptEcbPkcs7(key, data);

        using var aes = Aes.Create();
        aes.Key = key.ToArray();
        return aes.DecryptEcb(data, PaddingMode.PKCS7);
    }
}
