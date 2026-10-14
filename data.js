function parseList(text) {
    const items = (text || "").match(/'([^']*)'|"([^"]*)"/g) || [];
    return items.map(item => item.slice(1, -1)).join(" / ") || "Unknown";
}

async function loadCards(path) {
    const rows = await d3.csv(path);

    return rows
        .map(row => ({
            ...row,
            year: +row.release_date.slice(-4),
            type: parseList(row.types),
            subtype: parseList(row.subtypes),
            rarity: row.rarity || "Unknown",
            image: "Images/" + parseInt(row.ImageID) + "_200w.jpg"
        }))
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
    const cardIdByImageId = new Map(
        cards.map(card => [String(card.ImageID), card.id])
    );
    const cardSummaryByImageId = new Map(
        cards.map(card => {
            const imageId = String(card.ImageID);
            return [imageId, {
                imageId: imageId,
                name: card.name,
                price: Number.isFinite(+card.Price) ? +card.Price : 0
            }];
        })
    );
    const artists = d3.group(cards, card => card.artist);

    function summariesGroupedBy(field) {
        const grouped = d3.group(cards, card => card[field]);
        return new Map(Array.from(grouped, ([value, group]) => [
            value,
            group.map(card => cardSummaryByImageId.get(String(card.ImageID)))
        ]));
    }

    const cardSummariesByFieldValue = new Map([
        ["name", summariesGroupedBy("name")],
        ["rarity", summariesGroupedBy("rarity")],
        ["type", summariesGroupedBy("type")],
        ["subtype", summariesGroupedBy("subtype")]
    ]);
    const cardCountsByFieldValue = new Map(
        Array.from(cardSummariesByFieldValue, ([field, values]) => [
            field,
            new Map(Array.from(values, ([value, summaries]) => [value, summaries.length]))
        ])
    );

    const artistCardIds = Array.from(artists, ([artist, artistCards]) => ({
        artist: artist,
        cardIds: artistCards.map(card => card.id)
    }));
    const cardsByArtist = new Map(
        Array.from(artists, ([artist, artistCards]) => [artist, artistCards])
    );

    const mostFamousHighestEarningCards = Array.from(artists, ([artist, artistCards]) => {
        const nameCounts = d3.rollups(artistCards, group => group.length, card => card.name);
        const highestCount = d3.max(nameCounts, entry => entry[1]);
        const tiedNames = nameCounts.filter(entry => entry[1] === highestCount);
        const highestCardValueForName = name => d3.max(
            artistCards
                .filter(card => card.name === name)
                .map(card => Number.isFinite(+card.Price) ? +card.Price : 0)
        );
        const topName = d3.greatest(
            tiedNames,
            entry => highestCardValueForName(entry[0])
        )[0];
        const topNameCards = artistCards.filter(card => card.name === topName);
        const card = d3.greatest(
            topNameCards,
            card => Number.isFinite(+card.Price) ? +card.Price : 0
        );

        return {
            artist: artist,
            name: topName,
            cardId: card.id,
            price: +card.Price
        };
    });

    const cardsByName = d3.group(cards, card => card.name);
    const artistIsMostFrequentForFavoriteCard = new Map();

    mostFamousHighestEarningCards.forEach(function (favorite) {
        const nameCards = cardsByName.get(favorite.name) || [];
        const artistCounts = d3.rollups(
            nameCards,
            group => group.length,
            card => card.artist
        );
        const highestArtistCount = d3.max(artistCounts, entry => entry[1]) || 0;
        const selectedArtistCount = artistCounts.find(
            entry => entry[0] === favorite.artist
        );

        artistIsMostFrequentForFavoriteCard.set(
            favorite.artist,
            !!selectedArtistCount && selectedArtistCount[1] === highestArtistCount
        );
    });

    return {
        cardsById: cardsById,
        setCardIdsBySet: new Map(
            Array.from(d3.group(cards, card => card.set), ([set, group]) => [
                set,
                group.map(card => card.id)
            ])
        ),
        cardIdByImageId: cardIdByImageId,
        cardSummaryByImageId: cardSummaryByImageId,
        cardSummariesByFieldValue: cardSummariesByFieldValue,
        cardCountsByFieldValue: cardCountsByFieldValue,
        fieldValueIdsCache: new Map(),
        otherBubbleValuesCache: new Map(),
        selectedCardsCache: new Map(),
        artistCardIds: artistCardIds,
        cardsByArtist: cardsByArtist,
        mostFamousHighestEarningCards: mostFamousHighestEarningCards,
        artistIsMostFrequentForFavoriteCard: artistIsMostFrequentForFavoriteCard,
        artistCardIdsByArtist: new Map(artistCardIds.map(item => [item.artist, item.cardIds])),
        mostFamousHighestEarningByArtist: new Map(
            mostFamousHighestEarningCards.map(item => [item.artist, item])
        )
    };
}


function selectedCards(data, state, ignoreBubble) {
    const bubbles = state.bubbles || (state.bubble ? [state.bubble] : []);
    const cacheKey = JSON.stringify({
        artists: state.artists.slice().sort(),
        sets: state.sets.slice().sort(),
        bubbles: bubbles
            .map(bubble => bubble.field + "=" + bubble.value)
            .sort(),
        ignoreBubble: !!ignoreBubble
    });
    const cachedSelection = data.cache.selectedCardsCache.get(cacheKey);

    if (cachedSelection) {
        return cachedSelection;
    }

    // This is the most common gallery path. Return the already grouped cards
    // directly instead of creating an ID Set and looking every card up again.
    if (!ignoreBubble
        && state.artists.length === 1
        && state.sets.length === 0
        && bubbles.length === 0) {
        const artistCards = data.cache.cardsByArtist.get(state.artists[0]) || [];
        data.cache.selectedCardsCache.set(cacheKey, artistCards);
        return artistCards;
    }

    let selectedIds = null;

    function unionInto(ids) {
        if (!selectedIds) {
            selectedIds = new Set(ids);
            return;
        }

        ids.forEach(id => selectedIds.add(id));
    }

    function intersectWith(ids) {
        const allowed = new Set(ids);
        selectedIds = selectedIds
            ? new Set(Array.from(selectedIds).filter(id => allowed.has(id)))
            : allowed;
    }

    function idsForBubble(bubble) {
        const otherKey = [
            bubble.field,
            state.artists.slice().sort().join("|"),
            state.sets.slice().sort().join("|"),
            bubbles
                .filter(item => item.field !== bubble.field)
                .map(item => item.field + "=" + item.value)
                .sort()
                .join("|")
        ].join("##");

        const otherValues = bubble.value === "Other"
            ? data.cache.otherBubbleValuesCache.get(otherKey)
            : null;

        if (otherValues) {
            return Array.from(new Set(otherValues.flatMap(value => {
                const fieldValueKey = bubble.field + "\u0000" + value;
                const cachedIds = data.cache.fieldValueIdsCache.get(fieldValueKey);

                if (cachedIds) {
                    return cachedIds;
                }

                const values = data.cache.cardSummariesByFieldValue.get(bubble.field);
                const summaries = values ? values.get(value) || [] : [];
                const ids = summaries
                    .map(summary => data.cache.cardIdByImageId.get(summary.imageId))
                    .filter(Boolean);

                data.cache.fieldValueIdsCache.set(fieldValueKey, ids);
                return ids;
            })));
        }

        const fieldValueKey = bubble.field + "\u0000" + bubble.value;
        const cachedIds = data.cache.fieldValueIdsCache.get(fieldValueKey);

        if (cachedIds) {
            return cachedIds;
        }

        const values = data.cache.cardSummariesByFieldValue.get(bubble.field);
        const summaries = values ? values.get(bubble.value) || [] : [];
        const ids = summaries
            .map(summary => data.cache.cardIdByImageId.get(summary.imageId))
            .filter(Boolean);

        data.cache.fieldValueIdsCache.set(fieldValueKey, ids);
        return ids;
    }

    if (state.artists.length > 0) {
        state.artists.forEach(function (artist) {
            unionInto(data.cache.artistCardIdsByArtist.get(artist) || []);
        });
    }

    if (state.sets.length > 0) {
        const setIds = state.sets.flatMap(
            setName => data.cache.setCardIdsBySet.get(setName) || []
        );
        intersectWith(setIds);
    }

    if (!ignoreBubble) {
        bubbles.forEach(function (bubble) {
            intersectWith(idsForBubble(bubble));
        });
    }

    if (!selectedIds) {
        return data.cards;
    }

    const result = Array.from(selectedIds, id => data.cache.cardsById.get(id));
    data.cache.selectedCardsCache.set(cacheKey, result);

    // Keep this cache bounded because every distinct combination creates a
    // result array, and filter combinations can grow during a session.
    if (data.cache.selectedCardsCache.size > 128) {
        data.cache.selectedCardsCache.delete(data.cache.selectedCardsCache.keys().next().value);
    }

    return result;
}
