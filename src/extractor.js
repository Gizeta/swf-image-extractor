const stream = require('stream');
const zlib = require('zlib');
const JPEGDecoder = require('jpg-stream/decoder');
const PNGEncoder = require('png-stream/encoder');
const PNGDecoder = require('png-stream/decoder');
const concat = require('concat-frames');

module.exports = {
    extractBits: (tag, tablesTag) => {
        let bufferStream = new stream.PassThrough();
        bufferStream.write(tablesTag.jpegData);
        bufferStream.end(tag.jpegData);
        return bufferStream;
    },
    extractBitsJPEG2: (tag) => {
        let bufferStream = new stream.PassThrough();
        bufferStream.end(tag.imageData);
        return bufferStream;
    },
    extractBitsJPEG3: (tag) => {
        let enc = new PNGEncoder(0, 0, {colorSpace: 'rgba'});
        
        zlib.unzip(tag.bitmapAlphaData, (err, alphaBuf) => {
            if (err) throw new Error(err);

            let bufferStream = new stream.PassThrough();
            bufferStream.end(tag.imageData);
            bufferStream
                .pipe(new JPEGDecoder)
                .pipe(concat((frames) => {
                    let frame = frames[0];
                    let input = frame.pixels;
                    let output = new Buffer(frame.width * frame.height * 4);
                    for (let i = 0; i < alphaBuf.length; i++) {
                        output[4 * i] = input[3 * i];
                        output[4 * i + 1] = input[3 * i + 1];
                        output[4 * i + 2] = input[3 * i + 2];
                        output[4 * i + 3] = alphaBuf[i];
                    }

                    enc.format.width = frame.width;
                    enc.format.height = frame.height;
                    enc.end(output);
                }));
        });

        return enc;
    },
    extractBitsJPEG4: (tag) => {
        return extractBitsJPEG3(tag);
    },
    extractBitsLossless: (tag) => {
        let enc = new PNGEncoder(tag.bitmapWidth, tag.bitmapHeight, {colorSpace: 'rgb'});

        zlib.unzip(tag.zlibBitmapData, (err, dataBuf) => {
            if (err) throw new Error(err);

            let output = new Buffer(tag.bitmapHeight * tag.bitmapHeight * 3);
            let index = 0;
            let ptr = 0;
            switch (tag.bitmapFormat) {
                case 5: // FORMAT_24BIT_RGB
                case 4: // FORMAT_15BIT_RGB
                    for (let y = 0; y < tag.bitmapHeight; y++) {
                        for (let x = 0; x < tag.bitmapWidth; x++) {
                            if (tag.bitmapFormat == 4) {
                                let val = dataBuf[ptr] << 8 + dataBuf[ptr + 1];
                                output[index++] = (val & 0x7c00) >> 10;
                                output[index++] = (val & 0x3e0) >> 5;
                                output[index++] = val & 0x1f;
                                i += 2;
                            } else {
                                ptr++; // skip reversed byte
                                output[index++] = dataBuf[ptr++];
                                output[index++] = dataBuf[ptr++];
                                output[index++] = dataBuf[ptr++];
                            }
                        }
                        if (tag.bitmapWidth % 2 != 0) {
                            ptr += 2; // skip padding
                        }
                    }
                    break;
                case 3: // FORMAT_8BIT_COLORMAPPED
                    let colorMap = [];
                    for (let i = 0; i < tag.bitmapColorTableSize + 1; i++) {
                        colorMap.push([dataBuf[ptr++], dataBuf[ptr++], dataBuf[ptr++]]);
                    }
                    for (let y = 0; y < tag.bitmapHeight; y++) {
                        for (let x = 0; x < tag.bitmapWidth; x++) {
                            let idx = dataBuf[ptr++];
                            let color = idx < colorMap.length ? colorMap[idx] : [0, 0, 0];
                            output[index++] = color[0];
                            output[index++] = color[1];
                            output[index++] = color[2];
                        }
                        // skip padding
                        ptr += (4 - tag.bitmapWidth % 4) % 4;
                    }
                    break;
            }

            enc.end(output);
        });

        return enc;
    },
    extractBitsLossless2: (tag) => {
        let enc = new PNGEncoder(tag.bitmapWidth, tag.bitmapHeight, {colorSpace: 'rgba'});

        zlib.unzip(tag.zlibBitmapData, (err, dataBuf) => {
            if (err) throw new Error(err);

            let output = new Buffer(tag.bitmapWidth * tag.bitmapHeight * 4);
            let index = 0;
            let ptr = 0;
            switch (tag.bitmapFormat) {
                case 5: // FORMAT_32BIT_ARGB
                    for (let y = 0; y < tag.bitmapHeight; y++) {
                        for (let x = 0; x < tag.bitmapWidth; x++) {
                            let alpha = dataBuf[ptr++];
                            output[index++] = dataBuf[ptr++];
                            output[index++] = dataBuf[ptr++];
                            output[index++] = dataBuf[ptr++];
                            output[index++] = alpha;
                        }
                    }
                    break;
                case 3: // FORMAT_8BIT_COLORMAPPED
                    let colorMap = [];
                    for (let i = 0; i < tag.bitmapColorTableSize + 1; i++) {
                        let alpha = dataBuf[ptr++];
                        colorMap.push([dataBuf[ptr++], dataBuf[ptr++], dataBuf[ptr++], alpha]);
                    }
                    for (let y = 0; y < tag.bitmapHeight; y++) {
                        for (let x = 0; x < tag.bitmapWidth; x++) {
                            let idx = dataBuf[ptr++];
                            let color = idx < colorMap.length ? colorMap[idx] : [0, 0, 0, 0];
                            output[index++] = color[0];
                            output[index++] = color[1];
                            output[index++] = color[2];
                            output[index++] = color[3];
                        }
                        // skip padding
                        ptr += (4 - tag.bitmapWidth % 4) % 4;
                    }
                    break;
            }

            enc.end(output);
        });

        return enc;
    }
}
