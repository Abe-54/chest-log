//go:build ignore

// makeicon draws the Chest Log mark and writes it to icon.ico at 16, 32, 48 and
// 256 pixels. Run it from this folder: go run makeicon.go
//
// The mark is a gold rounded square turned 45 degrees with a smaller blue one in
// its centre, on a transparent background.
package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"log"
	"math"
	"os"
)

var (
	gold = [3]float64{0xff, 0xc8, 0x3d}
	blue = [3]float64{0x0d, 0x4f, 0x94}
)

// diamondCoverage is how much of the pixel at (x, y), measured from the icon's
// centre, lies inside a rounded square of half-width h turned 45 degrees.
func diamondCoverage(x, y, h float64) float64 {
	r := 0.4 * h
	u, v := math.Abs(x+y)/math.Sqrt2-(h-r), math.Abs(y-x)/math.Sqrt2-(h-r)
	distance := math.Hypot(math.Max(u, 0), math.Max(v, 0)) + math.Min(math.Max(u, v), 0) - r
	return math.Max(0, math.Min(1, 0.5-distance))
}

func render(size int) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, size, size))
	s := float64(size)
	for py := 0; py < size; py++ {
		for px := 0; px < size; px++ {
			x, y := float64(px)+0.5-s/2, float64(py)+0.5-s/2
			outer := diamondCoverage(x, y, 0.3765*s)
			inner := diamondCoverage(x, y, 0.135*s)
			var c [3]uint8
			for i := range c {
				c[i] = uint8(math.Round(gold[i]*(1-inner) + blue[i]*inner))
			}
			img.SetNRGBA(px, py, color.NRGBA{c[0], c[1], c[2], uint8(math.Round(outer * 255))})
		}
	}
	return img
}

// bitmapEntry is the classic icon image: a 32-bit bitmap plus an all-zero mask,
// since the alpha channel already says which pixels are see-through.
func bitmapEntry(img *image.NRGBA) []byte {
	size := img.Rect.Dx()
	var b bytes.Buffer
	binary.Write(&b, binary.LittleEndian, [10]uint32{40, uint32(size), uint32(2 * size), 1 | 32<<16, 0, 0, 0, 0, 0, 0})
	for y := size - 1; y >= 0; y-- {
		for x := 0; x < size; x++ {
			c := img.NRGBAAt(x, y)
			b.Write([]byte{c.B, c.G, c.R, c.A})
		}
	}
	b.Write(make([]byte, (size+31)/32*4*size))
	return b.Bytes()
}

func pngEntry(img *image.NRGBA) []byte {
	var b bytes.Buffer
	if err := png.Encode(&b, img); err != nil {
		log.Fatal(err)
	}
	return b.Bytes()
}

func main() {
	sizes := []int{16, 32, 48, 256}
	entries := make([][]byte, len(sizes))
	for i, size := range sizes {
		if size == 256 {
			entries[i] = pngEntry(render(size))
		} else {
			entries[i] = bitmapEntry(render(size))
		}
	}

	var ico bytes.Buffer
	binary.Write(&ico, binary.LittleEndian, [3]uint16{0, 1, uint16(len(sizes))})
	offset := 6 + 16*len(sizes)
	for i, size := range sizes {
		dimension := uint8(size) // 256 wraps to 0, which is how the format says 256
		binary.Write(&ico, binary.LittleEndian, struct {
			Width, Height, Colors, Reserved uint8
			Planes, BitCount                uint16
			Bytes, Offset                   uint32
		}{dimension, dimension, 0, 0, 1, 32, uint32(len(entries[i])), uint32(offset)})
		offset += len(entries[i])
	}
	for _, entry := range entries {
		ico.Write(entry)
	}
	if err := os.WriteFile("icon.ico", ico.Bytes(), 0o644); err != nil {
		log.Fatal(err)
	}
}
