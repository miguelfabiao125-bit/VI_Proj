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
    topArea.selectAll(".artist-reset").remove();

    const summary = topArea.append("div").attr("class", "artist-summary");
    const totalLabel = summary.append("div").attr("class", "artist-total");

    const artistName = totalLabel.append("div").attr("class", "artist-total-name");
    const totalRow = totalLabel.append("div").attr("class", "artist-total-row");
    const totalNumber = totalRow.append("span").attr("class", "artist-total-number");

    totalRow.append("span")
        .attr("class", "artist-total-icon")
        .attr("title", "Cards by the selected artists")
        .html(`
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
                <mask id="artist-total-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
                    <rect width="32" height="32" fill="white"/>
                    <rect x="11" y="6" width="16" height="22" rx="2.5" fill="black" stroke="black" stroke-width="3.5"/>
                </mask>
                <g mask="url(#artist-total-mask)">
                    <rect x="4" y="6" width="16" height="22" rx="2.5" transform="rotate(-14 12 17)"/>
                </g>
                <rect x="11" y="6" width="16" height="22" rx="2.5"/>
                <path d="M19 12 L23 17 L19 22 L15 17 Z"/>
            </svg>
        `);

    const resetButton = topArea.append("button")
        .attr("type", "button")
        .attr("class", "artist-reset")
        .text("Reset Filters")
        .on("click", () => actions.clearFilters());

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

        totalNumber.text(total);
        totalRow.style("display", total > 0 ? "flex" : "none");

         artistName
            .text(state.artists.length === 1 ? state.artists[0] : "")
            .style("visibility", state.artists.length === 1 ? "visible" : "hidden");

        // Keep the control clickable in every state. Clearing an already
        // empty filter set is a harmless no-op and avoids a disabled overlay.
        resetButton.property("disabled", false);
    }

    render();
    return { update: update };
}
