async function loadCards(path) {
    const rows = await d3.csv(path);

    return rows
        .map(row => ({ ...row, year: +row.release_date.slice(-4) }))
        .filter(card => card.artist && !isNaN(card.year));
}

function cardsPerArtistYear(cards) {
    const counts = d3.rollups(cards, group => group.length, card => card.artist, card => card.year);

    return counts.map(([artist, years]) => ({
        artist: artist,
        values: years
            .map(([year, count]) => ({ year: year, cards: count }))
            .sort((a, b) => a.year - b.year)
    }));
}

function yearsPerSet(cards) {
    return d3.rollup(cards, group => d3.min(group, card => card.year), card => card.set);
}

function artistsByDebut(artistSeries) {
    const byYear = d3.group(artistSeries, item => item.values[0].year);

    return Array.from(byYear, ([year, items]) => ({
        year: year,
        artists: items.map(item => item.artist).sort(d3.ascending)
    })).sort((a, b) => a.year - b.year);
}

function createCardCache(cards) {
    const cardsById = new Map(cards.map(card => [card.id, card]));
    const artists = d3.group(cards, card => card.artist);

    const artistCardIds = Array.from(artists, ([artist, artistCards]) => ({
        artist: artist,
        cardIds: artistCards.map(card => card.id)
    }));

    const mostFamousHighestEarningCards = Array.from(artists, ([artist, artistCards]) => {
        const nameCounts = d3.rollups(artistCards, group => group.length, card => card.name);
        const topName = d3.greatest(nameCounts, entry => entry[1])[0];
        const topNameCards = artistCards.filter(card => card.name === topName);
        const card = d3.greatest(topNameCards, card => +card.Price);

        return {
            artist: artist,
            name: topName,
            cardId: card.id,
            price: +card.Price
        };
    });

    return {
        cardsById: cardsById,
        artistCardIds: artistCardIds,
        mostFamousHighestEarningCards: mostFamousHighestEarningCards,
        artistCardIdsByArtist: new Map(artistCardIds.map(item => [item.artist, item.cardIds])),
        mostFamousHighestEarningByArtist: new Map(
            mostFamousHighestEarningCards.map(item => [item.artist, item])
        )
    };
}
