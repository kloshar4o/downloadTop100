const axios = require('axios');
const fs = require('fs');
const oldTracks = require('./oldTracks.json');

const cheerio = require('cheerio');
const ffmpeg = require('ffmpeg');
const ffmetadata = require("ffmetadata");
const ytSearch = require('yt-search');
const ytdl = require('ytdl-core');

const getTracksFromApple = (saveJson) => {

    let tracksArray = [];

    let url = 'https://music.apple.com/ru/playlist/top-100-moldova/pl.e4dcd4663130419bb03b80216dee9f57?l=en';

    axios(url)
        .then(response => {
            const html = response.data;
            const $ = cheerio.load(html);

            const tracks = $('.tracklist-item');


            for (let i = 0; i < tracks.length; i++) {

                let track = $(tracks[i]);

                let trackName = track.find('.tracklist-item__text__headline').text().replace(/[&]/g, 'And').replace(/[?]/g, '').trim();

                let trackArtist = track.find('a[data-test-song-artist-url]').text().replace(/[&]/g, 'And').replace(/[?]/g, '').trim();

                let trackObj = {
                    trackName: trackName.replace(/['"/]+/g, ''),
                    trackArtist: trackArtist.replace(/['"/]+/g, '')
                };


                tracksArray.push(trackObj);

                if (tracks.length === tracksArray.length) {
                    console.log('getTracksFromApple finished');
                    saveJson(tracksArray);
                }
            }


        })
        .catch(err => console.log(err))
};

const saveJson = function (tracks) {

    console.log('Start to save tracks');


    const tracksLoop = (trackIndex) => {

        let place = trackIndex + 1;


        if (place > 100) {

            //This is top100, so we are limiting for 100 tracks
            //so lets save the tracks json for the next fetch

            fs.writeFile('oldTracks.json', JSON.stringify(tracks, null, 2), 'utf8', (error) => {
                if (error) console.log(error)

            })

            //end loop
            return
        }

        let track = tracks[trackIndex];
        let name = track.trackName;
        let artist = track.trackArtist;
        let fileName = `${artist} - ${name}.mp3`;

        //We have this track in variable, we can declare the next track index
        trackIndex++;


        //Lets check if we have this track in /top100/
        //we are making a loop sequence
        //to check if any of the tracks in the json file
        //equals this track
        let oldPlace = 1;
        let endLoop = false;
        const checkIfTracksExist = (oldPlace) => {

            if (endLoop) return;

            if (oldPlace <= 100) {

                let oldTrackIndex = oldPlace - 1;
                let oldTrack = oldTracks[oldTrackIndex];

                let oldName = oldTrack.trackName;
                let oldArtist = oldTrack.trackArtist;
                let oldFileName = `${oldArtist} - ${oldName}.mp3`;

                let oldPath = `./top100/${oldPlace}. ${oldFileName}`;
                let newPath = `./top100/${place}. ${fileName}`;
                let tracksPath = `./tracks/${fileName}`;

                //This is top100, so we are limiting for 100 tracks


                // this is how this looks like:
                // does track "1. Scorpions - Wind Of Change.mp3" equals "43. Scorpions - Wind Of Change.mp3" exists?
                // does track "2. Scorpions - Wind Of Change.mp3" equals "43. Scorpions - Wind Of Change.mp3" exists?
                // and so on

                if (oldPath === newPath) {

                    //There it is "43. Scorpions - Wind Of Change.mp3"
                    //Ok, so we will rename the file if the postion in charts is changed,
                    //copy it to /tracks/ folder (or dont, if it already existed)

                    //End lets stop the loop
                    endLoop = true;

                    //we should already have this track file in our /top100/ folder
                    if (fs.existsSync(oldPath)) {

                        //Yes we do, so lets rename it, if the position in apple top 100 has changed
                        //meanwhile lets move on to the next track
                        tracksLoop(trackIndex);

                        if (oldPlace !== place) {
                            fs.rename(oldPath, newPath, error => {

                                if (error) {
                                    console.log(error);
                                } else {
                                    console.log(`${place}. ${fileName} found, renaming position from ${oldPlace}. to ${place}.`);

                                    addMetaData(newPath);

                                    //We are also making a copy to /tracks/ folder, if it doesnt exist there already
                                    if (!fs.existsSync(tracksPath))
                                        fs.createReadStream(newPath).pipe(fs.createWriteStream(tracksPath));

                                }
                            })
                        } else {
                            //Place in charts stays the same, we do nothing
                            console.log(`${place}. ${fileName} found`);

                            //We are also making a copy to /tracks/ folder, if it doesnt exist there already
                            if (!fs.existsSync(tracksPath))
                                fs.createReadStream(newPath).pipe(fs.createWriteStream(tracksPath));
                        }

                    } else {
                        //hmm, thats odd, it seems like the file doesnt exist, even though it should be
                        //maybe its moved, renamed or deleted... lets just download it and get to the next track
                        downloadTrack(place, name, artist, fileName, (returnFile) => {

                            addMetaData(place, name, artist, returnFile);

                            tracksLoop(trackIndex);
                        })

                    }
                } else {
                    //nothing found, lets check the next place/position
                    oldPlace++;
                    checkIfTracksExist(oldPlace);

                    if (oldPlace === 101) {
                        //Its a new track, lets download it

                        downloadTrack(place, name, artist, fileName, (returnFile) => {

                            addMetaData(place, name, artist, returnFile);

                            if (!fs.existsSync(tracksPath)){

                                //Good, now lets move the old song from this position to the /tracks/ folder if it exists
                                if (fs.existsSync(oldPath)) {

                                    fs.rename(oldPath, tracksPath, error => {
                                            if (error) console.log(error)
                                        }
                                    )
                                }

                            } else {
                                //We already have it, just delete  it
                                fs.unlink(oldPath, err => {
                                    if (err) console.log(err);
                                })
                            }

                            //Next track please
                            tracksLoop(trackIndex)
                        })

                    }
                }
            }
        };

        checkIfTracksExist(oldPlace)
    };

    tracksLoop(0);


};

const downloadTrack = (place, name, artist, fileName, callback) => {

    //Searching for video
    ytSearch(`${artist} - ${name} lyrics`, (err, r) => {

        if (err) throw err;

        //Getting first resoult
        let firstResult = r.videos[0];
        let id = firstResult.url;

        let track = `${artist} - ${name}`;
        let top100Path = `./top100/${place}. ${track}`;
        let trackPath = `./tracks/${place}. ${track}.mp3`;
        let mp3Path = `${top100Path}.mp3`;
        let mp4Path = `${top100Path}.mp4`;


        //Downloading video
        let stream = ytdl(
            'http://www.youtube.com' + id, //url
            {filter: (format) => format.container === 'mp4'}
        );

        //Saving video
        fs.access(mp3Path, fs.F_OK, (err) => {
            if (err) {
                console.log(`Downloading ${track}`);


                stream.pipe(fs.createWriteStream(mp4Path))
                return
            }

            console.log(`Exist ${track}`);
            callback();
            //file exists
        })


        stream.on('finish', () => {
            //Video saved, now lets try to convert it to mp3

            try {

                let proc = new ffmpeg(mp4Path);

                console.log(`Converting ${track} to mp3`)

                proc.then(video => {

                    video.file_path = '"' + mp4Path + '"';

                    video.fnExtractSoundToMP3(video.file_path, (error, file) => {
                        if (!error) {

                            console.log(`${place}. ${fileName} finished`);

                            //Delete video file
                            fs.unlink(mp4Path, err => {
                                if (err) console.log(err)
                            });

                            //We are also making a copy to /tracks/ folder, if it doesnt exist there already
                            if (!fs.existsSync(trackPath))
                                fs.createReadStream(mp3Path).pipe(fs.createWriteStream(trackPath));

                            callback(mp3Path);
                        } else {
                            console.log(error)
                        }
                    });
                }, function (err) {
                    console.log('Error: ' + err);
                });
            } catch (e) {
                console.log(e.code);
                console.log(e.msg);
            }
        });


    })
};

const addMetaData = (place, name, artist, path) => {


    let data = {
        artist: artist,
        title: name,
        track: place,
    };

    ffmetadata.write(path, data, function(err) {
        if (err) console.error("Error writing metadata", err);
        else console.log("Data written");
    });
}

getTracksFromApple(tracks => saveJson(tracks));
