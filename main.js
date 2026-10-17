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

    const state = { artists: [], years: [], sets: [], bubbles: [] };
    const views = [];

     const actions = {
        toggleArtist: function (artist) {
            state.artists = state.artists.includes(artist)
                ? state.artists.filter(name => name !== artist)
                : state.artists.concat(artist);
            updateViews();
        },

        selectSets: function (setNames) {
            state.sets = setNames;
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
            state.bubbles = [];
            updateViews();
        },
    };

    function updateViews() {
        views.forEach(view => view.chart && view.chart.update(state));
    }

    function addView(containerId, createChart) {
        const view = { container: document.getElementById(containerId), chart: null };
        let frame;

        function draw() {
            if (view.container.clientWidth === 0 || view.container.clientHeight === 0) {
                return;
            }
            view.container.innerHTML = "";
            view.chart = createChart(view.container, data, actions);
            view.chart.update(state);
        }

        view.redraw = draw;

        new ResizeObserver(function () {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(draw);
        }).observe(view.container);

        views.push(view);
    }

    addView("line-chart", createLineChart);
    addView("bar-chart", createBarChart);
    addView("artist-list", createArtistList);
    addView("artist-pair", createArtistPair);
    addView("card-gallery", createCardGallery);
    addView("bubble-chart", createBubbleChart);

    let windowResizeFrame;
    function redrawAfterViewportChange() {
        cancelAnimationFrame(windowResizeFrame);
        windowResizeFrame = requestAnimationFrame(function () {
            views.forEach(view => view.redraw());
        });
    }

    window.addEventListener("resize", redrawAfterViewportChange);
    document.addEventListener("fullscreenchange", redrawAfterViewportChange);

    window.selectSets = actions.selectSets; 
}

main();
