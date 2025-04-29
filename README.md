# purplefish
## Instructions to run:
Make sure that node and typescript are installed.
Ensure dependancies are installed:
```sh
pip3 install -r requirements.txt
```
Set the OpenAI API key environment variable:
```sh
export OPENAI_API_KEY="<your_api_key>"
```

Run the app:
```sh
python3 app.py
```

## Notes on implementation:
- The interview agent currently can only run an interview for one position. A next step would be to create a function that allows for the creation of multiple interview agents for different positions, and to create a triage agent that determines which agent the job applicant should speak to.
- Interviews are currently all called "Chat" - this is an incomplete aspect of this implementation. If I was alloted more time or this was a focus point of the challenge, I would make the titles distingiushable (e.g. by adding conversation id to them, or by allowing for the title to be input).
- The frontend is quite unpolished. First steps for improvement would be to style the chat selection and "New conversation" buttons.
- No considerations to security have been made.
- There is no caching of any sort to optimize runtime (we go to the DB for each chat message) - but this would be a good first step to improve runttime.
