async function main() {
    const cards = await loadCards("CPI-32.csv");

    const data = {
        cards: cards,
        artists: cardsPerArtistYear(cards),
        yearOfSet: yearsPerSet(cards)
    };

    const state = {
        artist: null,
        years: []
    };

    const views = [];

    const actions = {
        selectArtist: function (artist) {
            state.artist = artist;
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

    function addView(containerId, build) {
        const view = {
            container: document.getElementById(containerId),
            chart: null
        };

        view.draw = function () {
            if (view.container.clientWidth === 0 || view.container.clientHeight === 0) {
                return;
            }

            view.container.innerHTML = "";
            view.chart = build(view.container, data, actions);
            view.chart.update(state);
        };

        let pendingFrame;
        const resizeObserver = new ResizeObserver(function () {
            cancelAnimationFrame(pendingFrame);
            pendingFrame = requestAnimationFrame(view.draw);
        });
        resizeObserver.observe(view.container);

        views.push(view);
    }

    addView("line-chart", function (container, data, actions) {
        const chart = createLineChart(container, data.artists, actions.selectArtist);

        return {
            update: function (state) {
                chart.highlight(state.artist);
                chart.highlightYears(state.years);
            }
        };
    });

    window.selectSets = actions.selectSets;
}

main();
