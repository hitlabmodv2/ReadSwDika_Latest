const { getY2Mate } = require('./indexx');

(async () => {
    let url = "https://youtube.com/watch?v=kglEsR7bqAY";
    let format = "mp3"; // Bisa juga "mp4"
    let result = await getY2Mate(url, format);
    console.log(result);
})();

