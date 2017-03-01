const SWFReader = require('@gizeta/swf-reader');
const Extractor = require('./src/extractor');

module.exports = {
    JPEGTablesTag: SWFReader.TAGS.JPEGTables,
    DefineBitsTag: SWFReader.TAGS.DefineBits,
    DefineBitsJPEG2Tag: SWFReader.TAGS.DefineBitsJPEG2,
    DefineBitsJPEG3Tag: SWFReader.TAGS.DefineBitsJPEG3,
    DefineBitsJPEG4Tag: SWFReader.TAGS.DefineBitsJPEG4,
    DefineBitsLosslessTag: SWFReader.TAGS.DefineBitsLossless,
    DefineBitsLossless2Tag: SWFReader.TAGS.DefineBitsLossless2,

    getImageTags: (swfBuf) => {
        return new Promise((resolve, reject) => {
            SWFReader.read(swfBuf, (err, swf) => {
                if (err) {
                    reject(err);
                    return;
                }

                let jpegTablesTag = swf.tags.filter(t => t.header.code === SWFReader.TAGS.JPEGTables)[0];
                let jpgTags = swf.tags.filter(t => [
                    SWFReader.TAGS.DefineBits,
                    SWFReader.TAGS.DefineBitsJPEG2,
                    SWFReader.TAGS.DefineBitsLossless,
                ].includes(t.header.code)).map(t => Object.assign({
                    filetype: 'jpg'
                }, t));
                let pngTags = swf.tags.filter(t => [
                    SWFReader.TAGS.DefineBitsJPEG3,
                    SWFReader.TAGS.DefineBitsJPEG4,
                    SWFReader.TAGS.DefineBitsLossless2,
                ].includes(t.header.code)).map(t => Object.assign({
                    filetype: 'png'
                }, t));

                resolve(jpgTags.concat(pngTags), jpegTablesTag);
            });
        });
    },

    getImageStream: (tag, jpegTablesTag) => {
        switch (tag.header.code) {
            case SWFReader.TAGS.DefineBits:
                if (jpegTablesTag == null) {
                    throw new Error('There must be a JPEGTableTag');
                }
                return Extractor.extractBits(tag, jpegTablesTag);
            case SWFReader.TAGS.DefineBitsJPEG2:
                return Extractor.extractBitsJPEG2(tag);
            case SWFReader.TAGS.DefineBitsJPEG3:
                return Extractor.extractBitsJPEG3(tag);
            case SWFReader.TAGS.DefineBitsJPEG4:
                return Extractor.extractBitsJPEG4(tag);
            case SWFReader.TAGS.DefineBitsLossless:
                return Extractor.extractBitsLossless(tag);
            case SWFReader.TAGS.DefineBitsLossless2:
                return Extractor.extractBitsLossless2(tag);
        }
    }
}
