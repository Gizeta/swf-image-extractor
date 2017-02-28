#!/usr/bin/env node

const fs = require('fs');
const Extractor = require('../index');

let args = process.argv.slice(2);

Extractor.getImageTags(fs.openSync(`${args[0]}`, 'r'))
    .then((imageTags, jpegTablesTag) => {
        for (let tag of imageTags) {
            Extractor.getImageStream(tag, jpegTablesTag)
                .pipe(fs.createWriteStream(`${args[1]}/${tag.characterId}.${tag.filetype}`));
        }
    }).catch((err) => {
        throw new Error(err);
    });
