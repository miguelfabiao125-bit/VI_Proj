async function main() {
    const cards = await loadCards("CPI-32.csv");
    const artists = cardsPerArtistYear(cards);

    const data = {
        cards: cards,
        cache: createCardCache(cards),
        artists: artists,
        artistGroups: artistsByDebut(artists),
        yearOfSet: yearsPerSet(cards)
    };

    const state = { artists: [], years: [], sets: [], setsLabel: null, bubbles: [] };
    const views = [];

     const actions = {
        toggleArtist: function (artist) {
            state.artists = state.artists.includes(artist)
                ? state.artists.filter(name => name !== artist)
                : state.artists.concat(artist);
            updateViews();
        },

        selectSets: function (setNames, label) {
            state.sets = setNames;
            state.setsLabel = setNames.length > 0 ? (label || null) : null;
            state.years = setNames
                .map(name => data.yearOfSet.get(name))
                .filter(year => year !== undefined);
            updateViews();
        },

        selectBubble: function (field, value) {
            if (field === null || value === null) {
                state.bubbles = [];
            } else {
                const same = state.bubbles.some(
                    bubble => bubble.field === field && bubble.value === value
                );
                state.bubbles = state.bubbles.filter(bubble => bubble.field !== field);
                if (!same) {
                    state.bubbles.push({ field: field, value: value });
                }
            }
            updateViews();
        },

        clearBubble: function (field, value) {
            state.bubbles = state.bubbles.filter(
                bubble => bubble.field !== field || bubble.value !== value
            );
            updateViews();
        },

        clearArtists: function () {
            state.artists = [];
            updateViews();
        },

        clearFilters: function () {
            state.artists = [];
            state.years = [];
            state.sets = [];
            state.setsLabel = null;
            state.bubbles = [];
            updateViews();
        },
    };

    function updateViews() {
        views.forEach(view => view.chart && view.chart.update(state));
    }

    function addView(containerId, createChart) {
    const view = { container: document.getElementById(containerId), chart: null };
    let timer;
    let lastW = 0;
    let lastH = 0;

    function draw() {
        const w = view.container.clientWidth;
        const h = view.container.clientHeight;

        if (w === 0 || h === 0) {
            return;
        }
        if (w === lastW && h === lastH) {   // nada mudou, não redesenha
            return;
        }

        lastW = w;
        lastH = h;
        view.container.innerHTML = "";
        view.chart = createChart(view.container, data, actions);
        view.chart.update(state);
    }

    view.redraw = draw;

    new ResizeObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(draw, 120);      // espera a transição de fullscreen acabar
    }).observe(view.container);

    views.push(view);
}

    addView("line-chart", createLineChart);
    addView("bar-chart", createBarChart);
    addView("artist-list", createArtistList);
    addView("artist-pair", createArtistPair);
    addView("card-gallery", createCardGallery);
    addView("bubble-chart", createBubbleChart);


    window.selectSets = actions.selectSets; 
}

main();