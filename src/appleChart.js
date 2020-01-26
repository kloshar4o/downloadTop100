
const request = require('./request');
const cheerio = require('cheerio');

const get = async (url) => {

    let tracksArray = [];

    let { response, body } = await request.get(url)

    if (response.statusCode !== 200) {

        console.log(`Status: ${response.statusCode}`);
        console.log(`Message: ${response.statusMessage}`);

        return
    }

    const $ = cheerio.load(body);
    const tracks = $('.tracklist-item');

    let clean = function(string){
        return string
            .replace(/[&]/g, 'And')
            .replace(/[?]/g, '')
            .replace(/['"/]+/g, '');
    };

    for (let i = 0; i < tracks.length; i++) {

        let track = $(tracks[i]);

        let trackImgs = track.find('source').attr('srcset').split(',');

        let trackImg = trackImgs[trackImgs.length - 1].replace(' 3x', '').trim();

        let trackName = clean(track.find('.tracklist-item__text__headline').text().trim());

        let trackArtist = clean(track.find('a[data-test-song-artist-url]').text().trim());

        let trackObj = {
            trackImg: trackImg,
            trackName: trackName,
            trackArtist: trackArtist
        };


        tracksArray.push(trackObj);
    }

    console.log('getTracksFromApple finished');
    return tracksArray;
};

module.exports = { get };
