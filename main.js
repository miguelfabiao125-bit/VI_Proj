async function main() {
    const cards = await loadCards("CPI-32.csv");
    const cache = createCardCache(cards);
    const artists = cardsPerArtistYear(cards);

    const data = {
        cards: cards,
        cache: cache,
        artists: artists,
        artistGroups: artistsByDebut(artists),
        yearOfSet: yearsPerSet(cards)
    };

    const state = { artists: [], years: [] };
    const views = [];

    const actions = {
        toggleArtist: function (artist) {
            if (state.artists.includes(artist)) {
                state.artists = state.artists.filter(name => name !== artist);
            } else {
                state.artists = state.artists.concat(artist);
            }
            updateViews();
        },

        selectSets: function (setNames) {
            state.years = setNames
                .map(name => data.yearOfSet.get(name))
                .filter(year => year !== undefined);
            updateViews();
        }
    };

    function updateViews() {
        views.forEach(function (view) {
            if (view.chart) {
                view.chart.update(state);
            }
        });
    }

    function addView(containerId, createChart) {
        const view = { container: document.getElementById(containerId), chart: null };

        function draw() {
            if (view.container.clientWidth === 0 || view.container.clientHeight === 0) {
                return;
            }
            view.container.innerHTML = "";
            view.chart = createChart(view.container, data, actions);
            view.chart.update(state);
        }

        let frame;
        new ResizeObserver(function () {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(draw);
        }).observe(view.container);

        views.push(view);
    }

    addView("line-chart", createLineChart);
    addView("artist-list", createArtistList);
    addView("artist-pair", createArtistPair);
    addView("card-gallery", createCardGallery);

    window.selectSets = actions.selectSets;
}

main();
