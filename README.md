# purplefish
## Instructions to run:
Make sure that node and typescript are installed.
Ensure dependancies are installed:
```sh
pip3 install -r requirements.txt
```

Run the app:
```sh
python3 app.py
```

## Notes on implementation:
- The interview agent currently can only run an interview for one position. A next step would be to create a function that allows for the creation of multiple interview agents for different positions, and to create a triage agent that determines which agent the job applicant should speak to.
- No considerations to security have been made.
- There is no caching of any sort to optimize runtime (we go to the DB for each chat message) - but this would be a good first step to improve runttime.
