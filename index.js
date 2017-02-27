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
    
    for (let tag of swf.tags) {
        switch (tag.header.code) {
            case SWFReader.TAGS.DefineBitsJPEG3:
                extractBitsJPEG3(tag);
                break;
        }
    }
});

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
