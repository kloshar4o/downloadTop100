const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg')

const config = require('./config.json');
const appleChart = require('./src/appleChart');
const tracks = require('./src/tracks');


const init = async (playlist) => {

    let nextPlaylist = config.playlists.shift();
    let tracksName = playlist.tracksName;
    let url = playlist.appleLink;
    let musicFolder = config.musicFolder;
    let musicFolderAll = config.musicFolderAll;
    let blacklist = config.blacklist;

    let homeDir = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];

    let sep = path.sep;

    let musicPath = homeDir + sep + musicFolder + sep + tracksName + sep;
    let musicPathAll = musicPath + musicFolderAll + sep;


    if (!fs.existsSync(musicPath)) {
        fs.mkdirSync(musicPath, {recursive: true});
        fs.mkdirSync(musicPathAll, {recursive: true});
    }

    let tracksArray = await appleChart.get(url);
    let downloadList = await tracks.getNew(tracksArray, musicPath, musicPathAll, blacklist);



    const downloadTrack = ({place, name, artist, fileName}) => {
        let nextTrack = downloadList.shift();


        if (blacklist.includes(artist)) {

            downloadTrack(nextTrack);
            return;
        }

        tracks.download(place, name, artist, fileName, musicPath, musicPathAll, () => {

            if (nextTrack)
                downloadTrack(nextTrack);
        })
    };

    if (downloadList.length > 0) {
        let firstTrack = downloadList.shift();
        downloadTrack(firstTrack)
    };

    await init(nextPlaylist);
};

let firstPlaylist = config.playlists.shift();

init(firstPlaylist);


//getTracksFromApple(() => {});
