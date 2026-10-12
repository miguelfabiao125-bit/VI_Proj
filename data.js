async function loadCards(path) {
    const rows = await d3.csv(path);

    return rows
        .map(row => ({ ...row, year: +row.release_date.slice(-4) }))
        .filter(card => card.artist && !isNaN(card.year));
}

function cardsPerArtistYear(cards) {
    const countsByArtist = d3.rollups(
        cards,
        group => group.length,
        card => card.artist,
        card => card.year
    );

    return countsByArtist.map(function (entry) {
        const artist = entry[0];
        const yearCounts = entry[1];

        const values = yearCounts
            .map(pair => ({ year: pair[0], cards: pair[1] }))
            .sort((a, b) => a.year - b.year);

        return { artist: artist, values: values };
    });
}

function yearsPerSet(cards) {
    return d3.rollup(
        cards,
        group => d3.min(group, card => card.year),
        card => card.set
    );
}