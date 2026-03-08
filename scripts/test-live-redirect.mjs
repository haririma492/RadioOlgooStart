
const CHANNEL_ID = "UCat6bC0Wrqq9Bcq7EkH_yQw"; // IRANINTL

async function testRedirect() {
    const url = `https://www.youtube.com/channel/${CHANNEL_ID}/live`;
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        });
        console.log(`Final URL: ${res.url}`);
        const m = res.url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
        if (m) {
            console.log(`Found via redirect: ${m[1]}`);
        } else {
            console.log("No redirect to watch?v= found.");
            const html = await res.text();
            const m2 = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})">/);
            if (m2) {
                console.log(`Found via canonical: ${m2[1]}`);
            } else {
                console.log("No canonical link found either.");
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

testRedirect();
