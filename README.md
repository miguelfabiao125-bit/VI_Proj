# Pokémon Card Artists – Visualization Project

An interactive dashboard to explore Pokémon trading cards and the artists who illustrated them. It combines a bar chart (card value per generation, series and set), a Top 3 of artists, a line chart of cards per artist over time, a bubble chart of card categories, an artist list and a card gallery.

## Two versions of the project

This project exists in two versions. They have exactly the same code and the same features. The only difference is **where the card images come from**.

### 1. Moodle version (images loaded from links)

This is the version we submit on Moodle.

- The card images are not included in the zip file. Each image is loaded from an online link (the TCGplayer image server).
- Because of this, an internet connection is required to see the card images. Without internet, the charts still work, but the images will not appear.
- We know that working offline is preferred, but we chose this approach for a practical reason: the full image folder is too big for the space Moodle allows us to upload.

### 2. Offline version (images loaded from a local folder)

For the best experience, we also provide a second version of the project, which does not need internet.

- It is the same project, but it uses the `Images` folder, which contains all the card images that the Moodle version loads from links.
- It is available for download here: **[WeTransfer link – to be added]**
- The images load from your own computer, so they appear faster and the dashboard feels smoother.

We did not use the image folder in the Moodle submission for two reasons:

1. **It exceeds the upload size limit** that Moodle gives us.
2. **It made the project slower to load.** The folder contains a very large number of images.

## How the two versions differ in the code

The switch is in `data.js`. In the Moodle version it looks like this:

```js
const IMAGE_SOURCES = {
    remote: "https://tcgplayer-cdn.tcgplayer.com/product/",
    local: null
};

const PREFERRED_IMAGE_SOURCE = "remote";
```

In the offline version, the `Images` folder is used instead:

```js
const IMAGE_SOURCES = {
    remote: "https://tcgplayer-cdn.tcgplayer.com/product/",
    local: "Images/"
};

const PREFERRED_IMAGE_SOURCE = "local";
```

If one source fails to load an image, the code automatically tries the other one as a fallback.

## How to run

1. Unzip the project and keep the folder structure as it is.
2. Open the project through a local web server, and then open `index.html` in your browser. The data file (`CPI-32.csv`) is loaded with JavaScript, and many browsers block this when `index.html` is opened directly from the file system.
3. For the Moodle version, make sure you are connected to the internet.

## Project files

- `index.html` – the page and the layout of the dashboard
- `style.css` – all the styles
- `data.js` – data loading, image sources and shared helper functions
- `main.js` – the shared state and the connection between all the views
- `graphs/` – one file for each view: `barChart.js`, `lineChart.js`, `bubbleChart.js`, `artistList.js`, `artistPair.js` and `cardGallery.js`
- `CPI-32.csv` – the card dataset
- `img/` – the interface images (background and stars)
