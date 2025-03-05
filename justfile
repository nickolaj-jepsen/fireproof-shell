kill:
    @-pkill -f .fireproof-shel

dev: kill
    ags run --gtk4 app.ts 

watch: kill
    watchexec -e tsx,ts,scss -r "ags run --gtk4 app.ts"

notify-kitchensink:
    notify-send \
        "Title" \
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam eget purus nec nunc ultricies lacinia. Null Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam eget purus nec nunc ultricies lacinia. Nullam nec nunc nec nunc ultricies lacinia. am nec nunc nec nunc ultricies lacinia. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam eget purus nec nunc ultricies lacinia. Nullam nec nunc nec nunc ultricies lacinia." \
        --icon=dialog-information \
        --urgency=critical \
        --app-name="Justfile" \
        --action="Option 1" \
        --action="Option 2"

notify-long-title:
    notify-send \
        "A very long title that might just get cut off very long title that might just get cut off A very long title that might just get cut off very long title that might just get cut off" \
        "Hello world!" \
        --app-name="Justfile"

notify-many:
    notify-send \
        "Title 2 - normal" \
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam eget purus nec nunc ultricies lacinia. Null Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam eget purus nec nunc ultricies lacinia. Nullam nec nunc nec nunc ultricies lacinia. am nec nunc nec nunc ultricies lacinia. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam eget purus nec nunc ultricies lacinia. Nullam nec nunc nec nunc ultricies lacinia." \
        --app-name="Justfile" \
        --urgency=normal
    notify-send \
        "Title 1 - critical" \
        "Lorem ipsum dolor sit amet." \
        --app-name="Justfile" \
        --urgency=critical
    notify-send \
        "Title 3 - low" \
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam eget purus nec nunc ultricies lacinia. Nullam nec nunc nec nunc ultricies lacinia." \
        --app-name="Justfile" \
        --urgency=low
    notify-send \
        "Title 4 - Other app" \
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam eget purus nec nunc ultricies lacinia. Nullam nec nunc nec nunc ultricies lacinia." \
        --app-name="Other app" \
        --icon=dialog-information
