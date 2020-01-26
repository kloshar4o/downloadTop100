const fs = require("fs");
const ffmetadata = require("ffmetadata");
const { exec } = require("child_process");

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const addMetaData = (place, name, artist, path) => {

    let data = {
        artist: artist,
        title: name,
        track: place,
    };

    ffmetadata.write(path, data, function (err) {
        if (err) console.error("Error writing metadata", err);
        else console.log("Data written");
    });

};

const convert = async (mp4Path, mp3Path, place, name, artist, trackPath, callback) => {

    await sleep(500);

    exec('ffmpeg -i "'+mp4Path+'" -vn -ar 44100 -ac 2 -ab 192 -f mp3 "'+mp3Path+'"', async () => {

        await sleep(500);

        await addMetaData(place, name, artist, mp3Path);

        if (fs.existsSync(mp4Path)) {
            fs.unlink(mp4Path, err => {if(err) console.log(err)});
        }

        if (!fs.existsSync(trackPath)) {
            fs.copyFile(mp3Path, trackPath, err => {if(err) console.log(err)});
        }

        callback();


    });

};

module.exports = {addMetaData, convert};
