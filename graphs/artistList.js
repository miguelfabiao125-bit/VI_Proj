function createArtistList(container, data, actions) {
    let query = "";
    let selected = new Set();

    const panel = d3.select(container).append("div").attr("class", "artist-panel");
    const header = panel.append("div").attr("class", "artist-header");

    header.append("span").attr("class", "artist-title").text("Artists");

    const search = header.append("input")
        .attr("type", "search")
        .attr("class", "artist-search")
        .attr("placeholder", "Search")
        .attr("aria-label", "Search artists");

    const content = panel.append("div").attr("class", "artist-scroll")
        .append("div").attr("class", "artist-content");

    const topArea = d3.select(container.parentNode);
    topArea.selectAll(".artist-summary").remove();

    const summary = topArea.append("div").attr("class", "artist-summary");
    const totalLabel = summary.append("div").attr("class", "artist-total");
    const resetButton = summary.append("button")
        .attr("type", "button")
        .attr("class", "artist-reset")
        .text("Reset list")
        .on("click", () => actions.clearArtists());

    function render() {
        content.selectAll("*").remove();
        let counter = 0;

        data.artistGroups.forEach(function (group) {
            const names = group.artists.filter(name => name.toLowerCase().includes(query));
            if (names.length === 0) {
                return;
            }

            const section = content.append("div");
            section.append("div").attr("class", "artist-year").text(group.year);

            names.forEach(function (name) {
                counter++;
                const row = section.append("label").attr("class", "artist-row");

                row.append("input")
                    .datum(name)
                    .attr("type", "checkbox")
                    .property("checked", selected.has(name))
                    .on("change", (event, artist) => actions.toggleArtist(artist));

                row.append("span").text(counter + ". " + name);
            });
        });

        if (counter === 0) {
            content.append("div").attr("class", "artist-empty").text("No artists found");
        }
    }

    search.on("input", function () {
        query = this.value.trim().toLowerCase();
        render();
    });

        function update(state) {
        selected = new Set(state.artists);
        content.selectAll("input").property("checked", artist => selected.has(artist));

        const total = state.artists.reduce(function (sum, artist) {
            const ids = data.cache.artistCardIdsByArtist.get(artist);
            return sum + (ids ? ids.length : 0);
        }, 0);

        totalLabel.html(
            "<span class='artist-total-number'>" + total + "</span>" +
            "<span class='artist-total-text'>cards by " +
            (state.artists.length === 1 ? "this artist" : "selected artists") + "</span>"
        );

        resetButton.property("disabled", state.artists.length === 0);
    }

    render();
    return { update: update };
}
