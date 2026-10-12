function createArtistList(container, data, actions) {

    const groups = data.artistGroups;

    let selected = new Set();
    let query = "";
    const panel = d3.select(container)
        .append("div")
        .attr("class", "artist-panel");

    const header = panel.append("div").attr("class", "artist-header");

    header.append("span") .attr("class", "artist-title")
        .text("Artists");

    const search = header
        .append("input")
        .attr("type", "search")
        .attr("class", "artist-search")
        .attr("placeholder", "Search")
        .attr("aria-label", "Search artists");

    const scroller = panel
        .append("div")
        .attr("class", "artist-scroll");


    const content = scroller.append("div").attr("class", "artist-content");

    function render() {
        content.selectAll("*").remove();
        let counter = 0;

        groups.forEach(function(group) {
            const names = group.artists.filter(function(name) {
                return name.toLowerCase().includes(query);
            });

            if (names.length === 0) {
                return;
            }
                 const section = content
                .append("div")
                .attr("class", "artist-year-group");

            section.append("div")
                .attr("class", "artist-year")
                .text(group.year);


            names.forEach(function(name) {
                counter++;
                const row = section.append("label").attr("class", "artist-row");

                row.append("input")
                    .attr("type", "checkbox")
                    .datum(name)
                    .property(
                        "checked",
                        selected.has(name)
                    )
                    .on("change", function(event, artist) {

                        actions.toggleArtist(artist);

                    });
                row.append("span")
                    .text(counter + ". " + name);

            });

        });
        if (counter === 0) {

            content.append("div")
                .attr("class", "artist-empty")
                .text("No artists found");

        }
    }

    search.on("input", function() {
        query = this.value.trim().toLowerCase();
        render();
    });

    function update(state) {
        selected = new Set(state.artists);

        content
            .selectAll("input")
            .property(
                "checked",
                function(artist) {
                    return selected.has(artist);
                }
            );
    }

    render();
    return {
        update: update
    };
}