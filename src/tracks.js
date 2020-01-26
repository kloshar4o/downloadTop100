const fs = require('fs');
const ffmpeg = require('./ffmpeg');


const ytSearch = require('yt-search');
const ytdl = require('ytdl-core');

const getNew = async (tracks, musicPath, musicPathAll, blacklist) => {

    console.log('Start to save tracks');

    let tracksToDownload = [];

    let oldTracks = [];

    try {
        oldTracks = require(musicPath + 'oldTracks.json');

    } catch (_) {
        oldTracks = false;
    }

    const nextTrack = (trackIndex) => {

        let place = trackIndex + 1;

        if (place > tracks.length) {

            //This is top100, so we are limiting for 100 tracks
            //so lets save the tracks json for the next fetch

            fs.writeFile(musicPath + 'oldTracks.json', JSON.stringify(tracks, null, 2), 'utf8', (error) => {
                if (error) console.log(error)
            });

            //end loop
            return
        }

        let track = tracks[trackIndex];
        let name = track.trackName;
        let artist = track.trackArtist;
        let fileName = `${artist} - ${name}.mp3`;


        //We have this track in variable, we can declare the next track index
        trackIndex++;

        if (!oldTracks) {

            tracksToDownload.push({
                'place': place,
                'name': name,
                'artist': artist,
                'fileName': fileName,
            });

            nextTrack(trackIndex);

            return;
        }


        if (blacklist.includes(artist)) {

            nextTrack(trackIndex)
            return;

        }

        //Lets check if we have this track
        //we are making a loop sequence
        //to check if any of the tracks in the json file
        //equals this track
        let oldPlace = 1;

        const checkIfTracksExist = (oldPlace) => {

            if (oldPlace <= tracks.length) {

                let oldTrackIndex = oldPlace - 1;
                let oldTrack = oldTracks[oldTrackIndex];

                let oldName = oldTrack.trackName;
                let oldArtist = oldTrack.trackArtist;
                let oldFileName = `${oldArtist} - ${oldName}.mp3`;

                let oldPath = musicPath + `${oldPlace}. ` + oldFileName;
                let newPath = musicPath + `${place}. ` + fileName;
                let tracksPath = musicPathAll + fileName;


                if (blacklist.includes(oldArtist)) {


                    if (fs.existsSync(oldPath)) {
                        fs.unlink(oldPath, err => {
                            if (err) console.log(err)
                        });
                    }

                    if (fs.existsSync(tracksPath)) {
                        fs.unlink(tracksPath, err => {
                            if (err) console.log(err)
                        });
                    }
                }


                // this is how this looks like:
                // does track "1. Scorpions - Wind Of Change.mp3" equals "43. Scorpions - Wind Of Change.mp3" exists?
                // does track "2. Scorpions - Wind Of Change.mp3" equals "43. Scorpions - Wind Of Change.mp3" exists?
                // and so on

                if (oldPath === newPath) {


                    //There it is "43. Scorpions - Wind Of Change.mp3 === 43. Scorpions - Wind Of Change.mp3"


                    //we should already have this track file
                    if (fs.existsSync(oldPath)) {

                        //Yes we do
                        //meanwhile lets move on to the next track
                        nextTrack(trackIndex);

                        //so lets rename it, if the position in apple top 100 has changed
                        if (oldPlace !== place)

                            fs.rename(oldPath, newPath, error => {

                                if (error) console.log(error);
                                else {

                                    console.log(`${place}. ${fileName} found, renaming position from ${oldPlace}. to ${place}.`);
                                    ffmpeg.addMetaData(place, name, artist, newPath);
                                }
                            })

                    } else {
                        //hmm, thats odd, it seems like the file doesnt exist, even though it should be
                        //maybe its moved, renamed or deleted... lets just download it and get to the next track

                        tracksToDownload.push({
                            'place': place,
                            'name': name,
                            'artist': artist,
                            'fileName': fileName,
                        });


                        //Next track please
                        nextTrack(trackIndex)
                    }

                } else {
                    //nothing found

                    if (oldPlace === tracks.length) {

                        //Its a new track, lets download it
                        tracksToDownload.push({
                            'place': place,
                            'name': name,
                            'artist': artist,
                            'fileName': fileName,
                        });

                        if (fs.existsSync(oldPath)) {
                            fs.unlink(oldPath, err => {
                                if (err) console.log(err)
                            });
                        }

                        nextTrack(trackIndex)

                    } else {

                        //lets check the next place/position
                        oldPlace++;
                        checkIfTracksExist(oldPlace);

                    }
                }
            }
        };

        checkIfTracksExist(oldPlace)
    };

    nextTrack(0);

    return tracksToDownload;

};


const download = (place, name, artist, fileName, musicPath, musicPathAll, goNext) => {

    //Searching for video
    ytSearch(`${artist} - ${name} lyrics`, (err, r) => {

        if (err) {
            console.log(err);

        };

        //Getting first resoult
        let firstResult = r.videos[0];
        let id = firstResult.url;

        let track = `${artist} - ${name}`;
        let top100Path = musicPath + `${place}. ${track}`;
        let trackPath = musicPathAll + `${place}. ${track}.mp3`;
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

            goNext();
            console.log(`Exist ${track}`);
            //file exists
        })


        stream.on('finish', () => {

            //Video saved, now lets try to convert it to mp3
            ffmpeg.convert(mp4Path, mp3Path, place, name, artist, trackPath, () => {

                goNext();
            })

        });


    })
};

module.exports = {getNew, download};
