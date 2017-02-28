const fs = require('fs');
const zlib = require('zlib');
const stream = require('stream');
const SWFReader = require('swf-reader');
const JPEGDecoder = require('jpg-stream/decoder');
const PNGEncoder = require('png-stream/encoder');
const PNGDecoder = require('png-stream/decoder');
const concat = require('concat-frames');

let args = process.argv.slice(2);

SWFReader.read(`${args[0]}`, (err, swf) => {
    if (err) throw new Error(err);

    let jpegTablesTag = swf.tags.filter(t => t.header.code === SWFReader.TAGS.JPEGTables)[0];

    for (let tag of swf.tags) {
        switch (tag.header.code) {
            case SWFReader.TAGS.DefineBits:
                extractBits(tag, jpegTablesTag);
                break;
            case SWFReader.TAGS.DefineBitsJPEG2:
                extractBitsJPEG2(tag);
                break;
            case SWFReader.TAGS.DefineBitsJPEG3:
                extractBitsJPEG3(tag);
                break;
            case SWFReader.TAGS.DefineBitsJPEG4:
                extractBitsJPEG4(tag);
                break;
            case SWFReader.TAGS.DefineBitsLossless:
                extractBitsLossless(tag);
                break;
            case SWFReader.TAGS.DefineBitsLossless2:
                extractBitsLossless2(tag);
                break;
        }
    }
});

function extractBits(tag, tablesTag) {
    let bufferStream = new stream.PassThrough();
    bufferStream.pipe(fs.createWriteStream(`${args[1]}/${tag.characterId}.jpg`));
    bufferStream.write(tablesTag.jpegData);
    bufferStream.end(tag.jpegData);
}

function extractBitsJPEG2(tag) {
    let bufferStream = new stream.PassThrough();
    bufferStream.pipe(fs.createWriteStream(`${args[1]}/${tag.characterId}.jpg`));
    bufferStream.end(tag.imageData);
}

function extractBitsJPEG3(tag) {
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

                let enc = new PNGEncoder(frame.width, frame.height, {colorSpace: 'rgba'});
                enc.pipe(fs.createWriteStream(`${args[1]}/${tag.characterId}.png`));
                enc.end(output);
            }));
    });
}

function extractBitsJPEG4(tag) {
    extractBitsJPEG3(tag);
}

function extractBitsLossless(tag) {
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

        let enc = new PNGEncoder(tag.bitmapWidth, tag.bitmapHeight, {colorSpace: 'rgb'});
        enc.pipe(fs.createWriteStream(`${args[1]}/${tag.characterId}.png`));
        enc.end(output);
    });
}

function extractBitsLossless2(tag) {
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

        let enc = new PNGEncoder(tag.bitmapWidth, tag.bitmapHeight, {colorSpace: 'rgba'});
        enc.pipe(fs.createWriteStream(`${args[1]}/${tag.characterId}.png`));
        enc.end(output);
    });
}
