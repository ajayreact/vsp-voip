---
title: "Call Tracking"
source_url: "https://developers.telnyx.com/docs/voice/programmable-voice/call-tracking.md"
category: "call-control"
synced_at: "2026-06-25T18:43:05.639Z"
content_hash: "b3d09fe1c97bd32ffeec5529614d9c9b73a0be8d4668b4e06598131d1172cde1"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Call Tracking Demo

> How to build a call tracking application using Telnyx Voice API. Start building on Telnyx today.

\| [Python](#python) | [Node](#node) |

***

## Python

**⏱ 60 minutes build time.**

**🧰 Clone the sample application from our <a href="https://github.com/team-telnyx/demo-python-telnyx/tree/master/flask-call-tracking_call-control">GitHub repo</a>**

<hr />

In this tutorial, you'll learn how to build a **Call Tracking** application using the **Telnyx API**, and our **Python SDK**.

Call Control (the Telnyx Voice API), combined with our Numbers API, provides everything you need to build a robust number ordering and call tracking application:

* The Numbers API enables you to search the Telnyx phone number inventory in real time; filtering by Area Code, City/State, and more to find the perfect local number for your use-case.
* Call Control enables you to quickly setup dynamic forwarding numbers, toggle dual-channel recording, join/leave dynamic conferences, and pull post-call analytics.

By following this tutorial, you'll build an app that can:

> 1. Search and order phone numbers by a city and state combination.
> 2. Receive inbound calls to the Telnyx phone number.
> 3. Transfer calls using Call Control to your designated Forwarding Number.
> 4. Store all required information in a database of your choice.
> 5. Make a front-end that shows what's going on.

### Create a Telnyx mission control portal account

To get started, you'll need to <a href="https://telnyx.com/sign-up">create an account</a>. Verify your email address and you can log into the <a href="https://portal.telnyx.com">Mission Control Portal</a> to get started.

### Set up your local machine to receive webhooks from Telnyx

Next, you'll need a means of receiving webhooks sent by Telnyx to notify your application of call events. One of the easiest ways to accomplish this is to [use a tool like ngrok](/development/development-tools/ngrok-setup/index#ngrok) to generate a tunnelling URL, which connects to a locally running application via a port on your machine.

In this example, port `8000` is used. After downloading and installing ngrok, run `./ngrok http 8000` and make note of the resultant **HTTPS Forwarding URL**.

### Create a Telnyx call control application

From the Portal, create a new <a href="https://portal.telnyx.com/#/app/call-control/applications">Call Control Application</a>
, and paste the **HTTPS Forwarding URL** from the previous steps to send webhooks from this application to your local machine via ngrok.

Ensure API v2 is selected, and save your application. We don't need to worry about any other application settings for now.

Select your application again to edit it, and make a note of the **ID**. This is how you'll identify your Call Control Application in your code.

### Create an Outbound Voice profile

From the Portal, create a new <a href="https://portal.telnyx.com/#/app/outbound-profiles">Outbound Voice Profile</a>. Click **Add connections/apps to profile** and select the Call Control Application you created in the previous step.

In the **International Allowed Destinations** section, ensure you have selected the region(s) in which you want your application to work.

### Initialize and install packages via pip

Initialize your call tracking application with the defaults presented to you and create a virtual environment.

```bash theme={null}
mkdir call-tracking
cd call-tracking
python3 -m venv /path/to/new/virtual/environment
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Then install the necessary packages for the call tracking application. They can be found in this <a href="https://github.com/team-telnyx/demo-python-telnyx/blob/master/flask-call-tracking_call-control/Pipfile">Pipfile</a> or manually install them:

```bash theme={null}
pip install flask
pip install flask-modus
pip install python-dotenv
pip install telnyx
pip install peewee
pip install pymysql
pip install werkzeug==0.16.1
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Brief explanation on the required packages:

<a href="https://flask.palletsprojects.com/en/1.1.x/">Flask</a>:

### Set up environment variables

The following environment variables need to be set for your call tracking application to work:

<table class="table">
  <tbody>
    <tr>
      <td>Variable</td>
      <td>Description</td>
    </tr>

    <tr>
      <td><code>TELNYX\_API\_KEY</code></td>
      <td>Your <a href="https://portal.telnyx.com/#/app/api-keys">Telnyx API Key</a>, which can be created in the portal.</td>
    </tr>

    <tr>
      <td><code>TELNYX\_PUBLIC\_KEY</code></td>
      <td>Your <a href="https://portal.telnyx.com/#/app/account/public-key">Telnyx Public Key</a>, which is accessible via the portal.</td>
    </tr>

    <tr>
      <td><code>TELNYX\_CONNECTION\_ID</code></td>
      <td>The <strong>ID</strong> from your <a href="https://portal.telnyx.com/#/app/call-control/applications">Call Control Application</a></td>
    </tr>

    <tr>
      <td><code>MESSAGING\_PROFILE\_ID</code></td>
      <td>The <strong>ID</strong> from your <a href="https://portal.telnyx.com/#/app/messaging">Messaging Profile</a></td>
    </tr>

    <tr>
      <td><code>DATABASE\_HOST</code></td>
      <td>Connection of the host (ie. localhost or your local ip address)</td>
    </tr>

    <tr>
      <td><code>DATABASE\_USER</code></td>
      <td>Your database user name</td>
    </tr>

    <tr>
      <td><code>DATABASE\_PASSWORD</code></td>
      <td>Your database password</td>
    </tr>

    <tr>
      <td><code>DATABASE\_NAME</code></td>
      <td>Your database name</td>
    </tr>

    <tr>
      <td><code>DATABASE\_PORT</code></td>
      <td>Your database port</td>
    </tr>
  </tbody>
</table>

This app uses the excellent <a href="https://github.com/bkeepers/dotenv">dotenv</a> package to manage environment variables.

Make a copy of the file below, add your credentials, and save as `.env` in the root directory.

```bash theme={null}
TELNYX_API_KEY="YOUR_API_KEY"
TELNYX_CONNECTION_ID="YOUR_CALL_CONTROL_ID"
MESSAGING_PROFILE_ID="YOUR_MESSAGING_PROFILE_ID"


DATABASE_HOST="localhost"
DATABASE_USER="root"
DATABASE_PASSWORD=""
DATABASE_NAME="cctracker"
DATABASE_PORT=""
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Create some folders and Python files to build our call tracking application

We'll use a few `.py` files to build the call tracking application.

* `app.py` as our entry point to the application
* `database.py` for our database
* `database_queries.py` for our database controller
* `telnyx_commands.py` to manage most of our telnyx related functions

We would also like to categorize and sort these in a practical sense, so we are going to be making a few folders to sort the files into:

* `model` to host our databse related quieries
* `static` for our css and js
* `templates` as our entry point to everything html and frontend that we would want

So let's create our folders and files:

```bash theme={null}
mkdir model
mkdir static
mkdir templates

touch app.py
touch telnyx_commands.py

touch model/database.py
touch model/database_queries.py
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

This then should create the two files in our model directory, and two files in our base directory to get started

### Setup basic Telnyx commands

Here we will setup some basic commands to get ourselves going for the call tracking app. We will want the ability to procure some numbers via the API, have the capability to delete them, and look up some basic CNAM paramaters if we can.
As such, we will be creating some basic functions:

* telnyx\_number\_acquire(locality, administrative\_area): This will handle the number search and ordering portion of our app when given the specific arameters
  * We will be specifying locality and rate\_center which corresponds with City and State.
  * We will also go ahead and search for numbers that are SMS capable so we can future proof just in case we would want to be adding on an SMS component to this.
  * Setting limit as 1 to fetch and procure the first result
  * Making sure quickship is set as True, so we get numbers that are actively ready to go out of the box and will not have to wait for procurement.
  * We will want to return the `number_to_order` and `city_state_combo` to pass which number and from where exactly we procured this from

* telnyx\_number\_delete(number\_to\_delete): This will handle deleting phone numbers in our portal

* telnyx\_cnam\_lookup(calling\_number): This will handle using Telnyx Lookup service to see if we can get information on the number that's calling us
  * We will be returning the variable `cnam_info` with the result to use later on

* difference(start\_time, end\_time): This handles conversion of the webhook start/end times to get call durations
  * Webhook times are in full time format, so we will use the included datetime function to convert the time into seconds before doing the math to get the difference for the duration
  * We will be returning both `duration` and `date`

```python theme={null}
// In app.py
import telnyx
import os
import math
from flask import redirect, url_for, flash
from datetime import datetime

def telnyx_number_acquire(locality, administrative_area):
    city_state_combo = locality + ", " + administrative_area
    number_search = telnyx.AvailablePhoneNumber.list(filter={
        "locality": locality,
        "rate_center": administrative_area,
        "features": "sms",
        "limit": "1",
        "quickship": True,
    })
    # catch no result error
    if number_search.metadata.total_results != 1:
        flash("No results found for specified area, "
              "try again! Watch our for typos!")
        return redirect(url_for('index'))
    else:
        number_to_order = number_search.data[0]["phone_number"]
        number_order_response = telnyx.NumberOrder.create(
            phone_numbers=[
                {"phone_number": number_to_order,
                 },
            ],
            messaging_profile_id=os.getenv("MESSAGING_PROFILE_ID"),
            connection_id=os.getenv("TELNYX_CONNECTION_ID"),
        )
        return number_to_order, city_state_combo

def telnyx_number_delete(number_to_delete):
    retrieve = telnyx.PhoneNumber.retrieve(number_to_delete)
    retrieve.delete()

def telnyx_cnam_lookup(calling_number):
    resource = telnyx.NumberLookup.retrieve(calling_number)
    if resource.caller_name is None:
        cnam_info = "Not Available"
        return cnam_info
    else:
        cnam_info = resource.caller_name
        return cnam_info

# date and time difference function
def difference(start_time, end_time):
    end_time = ''.join(end_time)
    start_time = ''.join(start_time)
    d1 = datetime.strptime(end_time, '%Y-%m-%dT%H:%M:%S.%fZ')
    d2 = datetime.strptime(start_time, '%Y-%m-%dT%H:%M:%S.%fZ')
    d3 = d1 - d2
    d4 = d3.total_seconds()
    duration = math.ceil(d4)
    date = d2.date()
    return duration, date
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Database and database queries setup

We will need to now setup our database and store some of this data that we will be getting. You can setup a basic database in-memory, but obviously this results with the drawback of it being killed every time the app is restarted. As such, I've personally chosen to use Oracle SQL.
I believe a relational database makes the most sense in this case to use, as we are relating tracking inbound numbers that are calling us with forwarded phone numbers. ie. all the data that would be presented is tied to the same call/number combination.

So for this we will be creating two files:

* `database.py`: to setup and create our basic database

* `database_queries.py`: to provide all the functions we would need related to our database

#### in database.py

* We will be using peewee to connect to our database
* We will then define our table classes and add a function to create them at the end

```python theme={null}
import os
from dotenv import load_dotenv
from peewee import *
from peewee import CharField

load_dotenv()

mysql_db = MySQLDatabase(os.getenv('DATABASE_NAME'),
                         user=os.getenv('DATABASE_USER'),
                         password=os.getenv('DATABASE_PASSWORD'),
                         host=os.getenv('DATABASE_HOST'),
                         port=int(os.getenv('DATABASE_PORT')))

# Database setup

# inheritance for Meta (peewee), assigns DB to subsequent DB classes
class BaseModel(Model):
    class Meta:
        database = mysql_db

# peewee constructs id primary keys automatically (they are required to make queries)
class CallTracker(BaseModel):
    from_cnam_lookup = CharField()
    from_number = CharField()
    purchased_number = CharField()
    forward_number = CharField()
    date = CharField()
    duration_of_call = CharField()

class ForwardedPhoneNumbers(BaseModel):
    purchased_number = CharField()
    city_state = CharField()
    forward_number = CharField()
    tag = TextField()

# Create tables function
if __name__ == "__main__":
    mysql_db.connect()
    mysql_db.create_tables([CallTracker, ForwardedPhoneNumbers])
    print('Created tables! (or they already exist)')
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Now, if we were to run `database.py` (if you were to pass the correct dot.env variables related to database login), you should successfully be able to create the tables in your desired database.
For MySQL, do make sure your database schema is created first and matches your DATABASE\_NAME parameter, for example in MySQL Workbench

### Setup Flask Server for Number Ordering and Call Tracking

The `app.py` file sets up 5 routes:

* `/` : Our base route, where we will have our interface once we construct our index.html
* `/number` : To manage our number ordering and patching that we will be setting up
* `/call` : This path will relate to our call logging service that we will show. We will need to hit this if we would like to delete certain calls
* `/call-control/inbound` : This points to our main call-control processing
* `/call-control/outbound` : To manage our number ordering and patching that we will be setting up

We will be sending POST/PATCH/GET/DELETE requests to these endpoints. Take note that Flask only natively supports POST/GET requests. This is the reason we will be using <a href="https://github.com/rhyselsmore/flask-modus">Flask-modus</a> to override the methods. This allows us to be more secure and hit endpoints that make sense, preventing irregularities such as hitting a GET endpoint and that resulting in the deletion of data that you intended to keep.

```python theme={null}
import telnyx
import os
import json
from dotenv import load_dotenv
from flask import Flask, \
    render_template, request, Response, redirect, url_for, flash
from flask_modus import Modus
from urllib.parse import urlunsplit
from model.database_queries import db_fetch_data, \
    db_number_insert, db_number_update, db_number_row_identifier, \
    db_number_delete, db_call_delete, db_number_forward_fetch, \
    db_call_insert
from telnyx_commands import telnyx_number_acquire, \
    telnyx_number_delete, telnyx_cnam_lookup, difference

load_dotenv()

app = Flask(__name__)
modus = Modus(app)
app.secret_key = "SecretKey"

# homepage
@app.route('/')
def index():
    all_phone_numbers, all_call_data = db_fetch_data()

    return render_template('index.html',
                           all_phone_numbers=all_phone_numbers,
                           all_call_data=all_call_data, )

# search and order first number we get based on City/State
@app.route("/number/", methods=['POST'])
def acquire():

    # pull data to store in db later to display on frontend
    locality = request.form["city"]
    administrative_area = request.form["state"]
    forward_number = request.form["forward_number"]
    tag = request.form["tag"]
    city_state_combo = locality + ", " + administrative_area

    number_to_order, city_state_combo = telnyx_number_acquire(locality, administrative_area)

    db_number_insert(number_to_order, city_state_combo, forward_number, tag)

    flash("Phone Number:" + number_to_order +
          " Was Purchased Successfully!")

    return redirect(url_for('index'))

# using modus module to incorporate PATCH and DELETE requests
@app.route("/number/<id>/", methods=['PATCH', 'DELETE'])
def update(id):
    try:
        if request.method == b'PATCH':
            # grabbing id from index
            id = request.form.get('id')
            # updating new variables in update screen
            updated_forward_number = request.form["forward_number"]
            updated_tag = request.form["tag"]

            phone_number = db_number_update(id, updated_forward_number, updated_tag)
            flash("Phone Number" + phone_number + " Was Updated Successfully")

        elif request.method == b'DELETE':
            number_to_delete = db_number_row_identifier(id)
            # delete from telnyx portal
            telnyx_number_delete(number_to_delete)
            # delete from database and save
            db_number_delete(id)
            flash("Phone Number" + number_to_delete + " Successfully Deleted")

    except Exception as e:
        print("Error updating database")
        print(e)
    return redirect(url_for('index'))

@app.route("/call/<id>/", methods=['DELETE'])
def delete_call(id):

    if request.method == b'DELETE':
        db_call_delete(id)
        flash("Call Record Successfully Deleted!")

    return redirect(url_for('index'))

def handle_call_answered(call, called_number):
    number_to_forward_to = db_number_forward_fetch(called_number)

    webhook_url = urlunsplit((
        request.scheme,
        request.host,
        "/call-control/outbound",
        "", ""))
    transfer_params = {
        "to": number_to_forward_to,
        "webhook_url": webhook_url
    }
    call.transfer(**transfer_params)

@app.route("/call-control/inbound", methods=["POST"])
def inbound_call():
    # store some id values JUST IN CASE for troubleshooting purposes
    body = json.loads(request.data)
    calling_number = body["data"]["payload"]["from"]
    called_number = body["data"]["payload"]["to"]
    payload = call_control_id = body["data"]["payload"]
    call_control_id = body["data"]["payload"]["call_control_id"]
    call_session_id = body["data"]["payload"]["call_session_id"]
    call_leg_id = body["data"]["payload"]["call_leg_id"]
    event_type = body["data"]["event_type"]
    webhook_url = urlunsplit((
        request.scheme,
        request.host,
        "/call-control/outbound",
        "", ""))

    # construct call object, which is needed for initial call control commands
    call = telnyx.Call()
    call.call_control_id = call_control_id

    # main logic response based on inbound webhook events
    try:
        if event_type == "call.initiated":
            call = telnyx.Call(connection_id=os.getenv("TELNYX_CONNECTION_ID"))
            call.call_control_id = body.get("data").get("payload").get("call_control_id")
            call.answer()
            print(calling_number)
            print(called_number)
        elif event_type == "call.answered":
            handle_call_answered(call, called_number)
        elif event_type == "call.hangup":
            print(body)
            cnam_info = telnyx_cnam_lookup(calling_number)
            # time difference
            end_time = ''.join(body.get("data").get("payload").get("end_time"))
            start_time = ''.join(body.get("data").get("payload").get("start_time"))
            duration, date = difference(start_time, end_time)
            forward_number = db_number_forward_fetch(called_number)
            db_call_insert(cnam_info, calling_number, called_number, forward_number, date, duration)

    except Exception as e:
        print("Error processing webhook")
        print(e)
    return Response(status=200)

@app.route("/call-control/outbound", methods=["POST"])
def outbound_call():
    body = json.loads(request.data)
    call_leg_id = body[
        "data"][
        "payload"][
        "call_leg_id"]
    print(f"Received call_control event with call_leg_id: {call_leg_id}")
    return Response(status=200)

if __name__ == "__main__":
    telnyx.api_key = telnyx.os.getenv("TELNYX_API_KEY")
    TELNYX_APP_PORT = "8000"
    app.run(port=TELNYX_APP_PORT)
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Here we are importing our functions from the other files we made and constructing our routes with specific methods to perform those functions.

I want to focus specifically on the `/call-control/inbound` route.

Here we are performing the function of parsing through the incoming webhooks that we will be getting into our application, specifically:

* Receiving inbound call webhooks
* [Answering the inbound call](/api-reference/call-commands/answer-call)
* [Transferring the call](/api-reference/call-commands/transfer-call#transfer-call) to the destination number saved in the database
* Saving the [hangup event](https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/hangup/index#hangup) to the database

We also would like to save a good majority of the information from above. If you ever suffer problems from call quality/something not working, providing our NOC team the call\_control\_id/call\_session\_id will expedite the process of resolution to your inquiry.

### Building the front-end

The front-end was built with <a href="https://getbootstrap.com/">Boostrap</a> and <a href="https://mozilla.github.io/nunjucks/">Nunjucks</a>.

I won't go into much detail about building it out in this article, but if you want to attach your methods from above simply import the resources located in the <a href="https://github.com/team-telnyx/demo-python-telnyx/tree/master/flask-call-tracking_call-control/static">static</a> and <a href="https://github.com/team-telnyx/demo-python-telnyx/tree/master/flask-call-tracking_call-control/templates">templates</a> folders located on our <a href="https://github.com/team-telnyx/demo-python-telnyx/tree/master/flask-call-tracking_call-control">GitHub</a> page.

### Running the call tracking application

We should now be able to run the application!

### Launch ngrok and update your call control application

We need to be able to receive webhooks from Telnyx, sent over the public Internet. We'll use [ngrok](/development/development-tools/ngrok-setup/index#ngrok) for this tutorial.

Launch ngrok on the `PORT` specified in your `.env` file. If you're using port `8000` (the default for this app), you can simply run `./ngrok http 8000`

```bash theme={null}
$ ./ngrok http 8000

ngrok by @inconshreveable

Session Status                online
Account                       Little Bobby Tables (Plan: Free)
Version                       2.x.x
Region                        United States (us)
Web Interface                 http://127.0.0.1:4040
Forwarding                    http://ead8b6b4.ngrok.io -> localhost:8000
Forwarding                    https://ead8b6b4.ngrok.io -> localhost:8000

Connections                   ttl     opn     rt1.   rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Once you've set up ngrok (or another tunneling service of your choice) you can add the public proxy URL to your Inbound Settings in the Mission Control Portal.

To do this, click  the edit symbol \[**✎**] next to your <a href="https://portal.telnyx.com/#/app/call-control/applications">Call Control Application</a>

In the **Send a webhook to the URL:** field, paste the forwarding address from ngrok into the Webhook URL field. Add `/call-control/inbound` to the end of the URL to direct the request to the webhook endpoint in your server.

If we were using the example URL from the code sample above, the URL would be `http://ead8b6b4.ngrok.io/call-control/inbound`.

### Run the APP.PY Call tracking application

Start the server by running `python app.py`.

Once everything is setup, you should now be able to:

* Search and purchase a number based on your parameters
* Allocate the purchased number to your desired forwarding number
* Track your acquired forwarded phone numbers in your database
* Record and store call information relating to those numbers in your database
* Present all of this information in your UI

### Call tracking follow-ons

Now that you've successfully constructed this application, you have the freedom to expand it as you wish! You can start saving even more information from the webhooks such as IDs in your database by adding more tables, you can add more routes to handle inbound messaging functions, you can add recording/auto answer functions... it's all up to you!

Our <a href="https://joinslack.telnyx.com/">developer Slack community</a> is full of Python developers like you - be sure to join to see what your fellow developers are building!

## Node

**⏱ 60 minutes build time.**

**🧰 Clone the sample application from our<a href="https://github.com/team-telnyx/demo-node-telnyx/tree/master/call-tracking">GitHub repo</a>**

<hr />

In this tutorial, you'll learn how to build a **Call Tracking** application using the **Telnyx API**, and our **Node SDK**.

Programmable Voice, combined with our Numbers API, provides everything you need to build a robust call tracking application:

* The Numbers API enables you to search the Telnyx phone number inventory in real time; filtering by Area Code, City/State, and more to find the perfect local number for your use-case.
* Call Control enables you to quickly setup dynamic forwarding numbers, toggle dual-channel recording, join/leave dynamic conferences, and pull post-call analytics.

By following this tutorial, you'll build an app that can:

> 1. Search and order a phone number by area code.
> 2. Store a 'binding' of Telnyx phone numbers to a forwarding number (to which incoming calls to the Telnyx phone numbers will be forwarded).
> 3. Receive inbound calls to the Telnyx phone number.
> 4. Transfer calls using Call Control.
> 5. Store webhook events associated with calls to a datastore.

### Create a Telnyx mission control portal account

This tutorial assumes you've already [set up your developer account and environment](/development) and you know how to [send commands](/docs/voice/programmable-voice/sending-commands) and [receive webhooks](/docs/voice/programmable-voice/receiving-webhooks) using Call Control.

### Set up your local machine to receive webhooks from Telnyx

One of the easiest ways to accomplish this is to [use at tool like ngrok ](/development/development-tools/ngrok-setup/index#ngrok) to generate a tunnelling URL, which connects to a locally running application via a port on your machine.

In this example, port `8000` is used. After downloading and installing ngrok, run `./ngrok http 8000` and make note of the resultant **HTTPS Forwarding URL**.

### Create a Telnyx call control application

From the Portal, create a new <a href="https://portal.telnyx.com/#/app/call-control/applications">Call Control Application</a>
, and paste the **HTTPS Forwarding URL** from the previous steps to send webhooks from this application to your local machine via ngrok.

Ensure API v2 is selected, and save your application. We don't need to worry about any other appliction settings for now.

Select your application again to edit it, and make a note of the **ID**. This is how you'll identify your Call Control Application in your code.

### Create an outbound voice profile

From the Portal, create a new <a href="https://portal.telnyx.com/#/app/outbound-profiles">Outbound Voice Profile</a>. Click **Add connections/apps to profile** and select the Call Control Application you created in the previous step.

In the **International Allowed Destinations** section, ensure you have selected the region(s) in which you want your application to work.

### Initialize and Install packages via npm

Initialize your call tracking application with the defaults presented to you.

```bash theme={null}
mkdir call-tracking
cd call-tracking
npm init
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Then install the necessary packages for the call tracking application

```bash theme={null}
npm i dotenv
npm i express
npm i telnyx
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

This will create a `package.json` file with the packages needed to run the application.

### Set up environment variables

The following environment variables need to be set for your call tracking application to work:

<table class="table">
  <tbody>
    <tr>
      <td>Variable</td>
      <td>Description</td>
    </tr>

    <tr>
      <td><code>TELNYX\_API\_KEY</code></td>
      <td>Your <a href="https://portal.telnyx.com/#/app/api-keys">Telnyx API Key</a>, which can be created in the portal.</td>
    </tr>

    <tr>
      <td><code>TELNYX\_PUBLIC\_KEY</code></td>
      <td>Your <a href="https://portal.telnyx.com/#/app/account/public-key">Telnyx Public Key</a>, which is accessible via the portal.</td>
    </tr>

    <tr>
      <td><code>TELNYX\_CONNECTION\_ID</code></td>
      <td>The <strong>ID</strong> from your <a href="https://portal.telnyx.com/#/app/call-control/applications">Call Control Application</a></td>
    </tr>

    <tr>
      <td><code>PORT</code></td>
      <td>The port through which the app will be served. <strong>This variable defaults to <code>8000</code></strong></td>
    </tr>
  </tbody>
</table>

This app uses the excellent <a href="https://github.com/bkeepers/dotenv">dotenv</a> package to manage environment variables.

Make a copy of the file below, add your credentials, and save as `.env` in the root directory.

```bash theme={null}
TELNYX_PUBLIC_KEY=
TELNYX_API_KEY=
TELNYX_CONNECTION_ID=
PORT=8000
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Create JavaScript files to build a Call Tracking Application

We'll use a few `.js` files to build the call tracking application.

* `index.js` as our entry point to the application
* `db.js` for our database controller (in-memory DB for sample)
* `callControl.js` to manage call-control webhooks
* `bindings.js` to manage call-tracking bindings and post-call metadata

```bash theme={null}
touch index.js
touch db.js
touch callControl.js
touch bindings.js
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Setup Express Server for Call Tracking

The `index.js` file sets up 2 express routes:

* `/call-control` : To handle call-control webhooks
* `/bindings` : To manage phone number bindings and call information

```js theme={null}
// In index.js
import 'dotenv/config';
dotenv.config();

import express from 'express';
import bindings from './bindings';
import callControl from './callControl';
const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));

const callControlPath = '/call-control';
app.use(callControlPath, callControl);

const bindingsPath = '/bindings'
app.use(bindingsPath, bindings);

app.listen(process.env.TELNYX_APP_PORT);
console.log(`Server listening on port ${process.env.TELNYX_APP_PORT}`);
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Setup database for Call Tracking information

The `db.js` file contains the in-memory database to manage our phone numbers and call information. It exports 1 array and 3 functions:

* `bindings = []` : Our in-memory database
* `addPhoneNumberBinding` : accepts a Telnyx phone number and a destination number to save to the database.
  * Called when ordering / creating a new call-tracking number
* `getDestinationPhoneNumber` : accepts a Telnyx phone number and searches the database for a match, then returns the destination phone number.
  * Called when receiving an inbound call to look up transfer destination.
* `saveCall` : accepts a Telnyx event and saves the call to the database based on the payload.
  * Called when the `call.hangup` event is received to save post-call information
* `getBinding`: accepts a Telnyx phone number and returns the matching binding information from the database.
  * Called when `GET` bindings has a telnyxPhoneNumber query parameter

```javascript theme={null}
// in db.js
export const bindings = [];

export const addPhoneNumberBinding = (telnyxPhoneNumber, destinationPhoneNumber) => {
  const index = bindings.findIndex(binding => binding.telnyxPhoneNumber === telnyxPhoneNumber);
  if (index > 0) {
    return {
      ok: false,
      message: `Binding of Telnyx: ${telnyxPhoneNumber} already exists`,
      binding: bindings[index]
    }
  }
  const binding = {
    telnyxPhoneNumber,
    destinationPhoneNumber,
    calls: []
  }
  bindings.push(binding);
  return { ok: true }
};

export const getDestinationPhoneNumber = telnyxPhoneNumber => {
  const destinationPhoneNumber = bindings
    .filter(binding => binding.telnyxPhoneNumber === telnyxPhoneNumber)
    .reduce((a, binding) => binding.destinationPhoneNumber, '');
  return destinationPhoneNumber;
};

export const saveCall = callWebhook => {
  const telnyxPhoneNumber = callWebhook.payload.to;
  const index = bindings.findIndex(
      binding => binding.telnyxPhoneNumber === telnyxPhoneNumber);
  bindings[index].calls.push(callWebhook);
};

export const getBinding = telnyxPhoneNumber => {
  return bindings.filter(
      binding => binding.telnyxPhoneNumber === telnyxPhoneNumber);
};

```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Managing phone number bindings for Call Tracking

The `bindings.js` file contains all the logic for:

* [Searching Phone Numbers](/api-reference/phone-number-search/list-available-phone-numbers) by area code (also known as `national_destination_code`)
* [Ordering Phone Numbers](/api-reference/phone-number-orders/create-a-number-order) and setting the `connection_id` as part of the order
* Saving the binding to the database
* Routes for fetching binding information

```javascript theme={null}
// in bindings.js
import express from 'express';
import Telnyx from 'telnyx';
import db from './db';

const telnyx = new Telnyx("YOUR_API_KEY");
export const router = express.Router();
const CONNECTION_ID = process.env.TELNYX_CONNECTION_ID;

const searchNumbers = async (req, res, next) => {
  const isInvalidRequest = (!req.body.areaCode || !req.body.destinationPhoneNumber || req.body.areaCode.length !== 3)
  if (isInvalidRequest) {
    res.send({
      message: 'Invalid search criteria, please send 3 digit areaCode',
      example: '{ "areaCode": "919", "destinationPhoneNumber": "+19198675309" }'
    });
    return;
  }
  try {
    const areaCode = req.body.areaCode;
    const availableNumbers = await telnyx.availablePhoneNumbers.list({
      filter: {
        national_destination_code: areaCode,
        features: ["sms", "voice", "mms"],
        limit: 1
      }
    });
    const phoneNumber = availableNumbers.data.reduce((a, e) => e.phone_number, '');
    if (!phoneNumber) {
      res.send({message: 'No available phone numbers'}).status(200);
    } else {
      res.locals.phoneNumber = phoneNumber;
      next();
    }
  } catch (e) {
    const message = ''
    console.log(message);
    console.log(e);
    res.send({message}, ...e).status(400);
  }
}

const orderNumber = async (req, res, next) => {
  try {
    const phoneNumber = res.locals.phoneNumber;
    const result = await telnyx.numberOrders.create({
      connection_id: CONNECTION_ID,
      phone_numbers: [{
        phone_number: phoneNumber
      }]
    });
    res.locals.phoneNumberOrder = result.data;
    next();
  } catch (e) {
    const message = `Error ordering number: ${res.locals.phoneNumber}`
    console.log(message);
    console.log(e);
    res.send({message}, ...e).status(400);
  }
}

const saveBinding = async (req, res) => {
  try {
    const telnyxPhoneNumber = res.locals.phoneNumber;
    const destinationPhoneNumber = req.body.destinationPhoneNumber;
    db.addPhoneNumberBinding(telnyxPhoneNumber, destinationPhoneNumber);
    res.send(res.locals.phoneNumberOrder);
  } catch (e) {
    res.send(e).status(409);
  }
}

const getBindings = async (req, res) => {
  if (req.query.telnyxPhoneNumber) {
    const telnyxPhoneNumber = req.query.telnyxPhoneNumber;
    const binding = db.getBinding(telnyxPhoneNumber);
    res.send(binding).status(200);
  } else {
    res.send(db.bindings);
  }
}

router.route('/')
.post(searchNumbers, orderNumber, saveBinding)
.get(getBindings);
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Managing call flows for call tracking

The `callControl.js` file contains the routes and functions for:

* Receiving inbound call webhooks
* [Answering the inbound call](/api-reference/call-commands/answer-call)
* [Transferring the call](/api-reference/call-commands/transfer-call#transfer-call) to the destination number saved in the database
* Saving the [hangup event](https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/hangup/index#hangup) to the database

```js theme={null}
// in callControl.js
import express from 'express';
import Telnyx from 'telnyx';
import db from './db';

const telnyx = new Telnyx("YOUR_API_KEY");
export const router = express.Router();

const outboundCallController = async (req, res) => {
  res.sendStatus(200); // Play nice and respond to webhook
  const event = req.body.data;
  const callIds = {
    call_control_id: event.payload.call_control_id,
    call_session_id: event.payload.call_session_id,
    call_leg_id: event.payload.call_leg_id
  }
  console.log(`Received Call-Control event: ${event.event_type} DLR with call_session_id: ${callIds.call_session_id}`);
}

const handleInboundAnswer = async (call, event, req) => {
  console.log(`call_session_id: ${call.call_session_id}; event_type: ${event.event_type}`);
  try {
    const webhook_url = (new URL('/call-control/outbound', `${req.protocol}://${req.hostname}`)).href;
    const destinationPhoneNumber = db.getDestinationPhoneNumber(event.payload.to);
    await call.transfer({
      to: destinationPhoneNumber,
      webhook_url
    })
  } catch (e) {
    console.log(`Error transferring on call_session_id: ${call.call_session_id}`);
    console.log(e);
  }
}

const handleInboundHangup = (call, event) => {
  console.log(`call_session_id: ${call.call_session_id}; event_type: ${event.event_type}`);
  db.saveCall(event);
}

const inboundCallController = async (req, res) => {
  res.sendStatus(200); // Play nice and respond to webhook
  const event = req.body.data;
  const callIds = {
    call_control_id: event.payload.call_control_id,
    call_session_id: event.payload.call_session_id,
    call_leg_id: event.payload.call_leg_id
  }
  const call = new telnyx.Call(callIds);
  switch (event.event_type) {
    case 'call.initiated':
      await call.answer();
      break;
    case 'call.answered':
      await handleInboundAnswer(call, event, req);
      break;
    case 'call.hangup':
      handleInboundHangup(call, event);
      break;
    default:
      console.log(`Received Call-Control event: ${event.event_type} DLR with call_session_id: ${call.call_session_id}`);
  }
}

router.route('/outbound')
.post(outboundCallController);

router.route('/inbound')
.post(inboundCallController);
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Running the Call Tracking application

Now that you've saved all the examples and built your routes, it's time to run the application.

### Launch ngrok and update your Call Control Application

We need to be able to receive webhooks from Telnyx, sent over the public Internet. We'll use [ngrok](/development/development-tools/ngrok-setup/index#ngrok) for this tutorial.

Launch ngrok on the `PORT` specified in your `.env` file. If you're using port `8000` (the default for this app), you can simply run `./ngrok http 8000`

```bash theme={null}
$ ./ngrok http 8000

ngrok by @inconshreveable

Session Status                online
Account                       Little Bobby Tables (Plan: Free)
Version                       2.x.x
Region                        United States (us)
Web Interface                 http://127.0.0.1:4040
Forwarding                    http://ead8b6b4.ngrok.io -> localhost:8000
Forwarding                    https://ead8b6b4.ngrok.io -> localhost:8000

Connections                   ttl     opn     rt1.   rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Once you've set up ngrok (or another tunneling service of your choice) you can add the public proxy URL to your Inbound Settings in the Mission Control Portal.

To do this, click  the edit symbol \[**✎**] next to your <a href="https://portal.telnyx.com/#/app/call-control/applications">Call Control Application</a>

In the **Send a webhook to the URL:** field, paste the forwarding address from ngrok into the Webhook URL field. Add `/call-control/inbound` to the end of the URL to direct the request to the webhook endpoint in your server.

If we were using the example URL from the code sample above, the URL would be `http://ead8b6b4.ngrok.io/call-control/inbound`.

### Run the Node.JS call tracking application

Start the server by running `node index.js`.

Once everything is setup, you should now be able to:

* Allocate a new call tracking number and bind it to a forwarding number
* Call the allocated number and get connected to the destination.

### Create a binding for call tracking

The bindings interface is managed through a RESTful API.

To create a new binding create a `POST` request to your ngrok URL (in this example: `http://ead8b6b4.ngrok.io/bindings`)

The `POST` request accepts a JSON object with the following fields:

* `areaCode`: Desired area code for the new call tracking phone number
* `destinationPhoneNumber` : Number which we'll forward all incoming calls to the call-tracking phone number

```http theme={null}
POST http://ead8b6b4.ngrok.io/bindings HTTP/1.1
Content-Type: application/json; charset=utf-8

{
  "areaCode" : "919",
  "destinationPhoneNumber": "+19198675309"
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

The application will search the Telnyx number inventory for a phone number matching the `areaCode` passed, and will order the first result returned from the API. It then creates a binding so that any inbound call to the Telnyx phone number is forwarded to the destination phone number.

### List call tracking bindings and call information

The bindings endpoint supports a `GET` request to pull call information and existing bindings.

The bindings object returns a `calls` array with the hangup webhooks saved. The length of the array equals the number of calls the call tracking number received. The duration for each call can be calculated as the difference between the `start_time` and `end_time` values.

```http theme={null}
GET http://ead8b6b4.ngrok.io/bindings HTTP/1.1

HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "telnyxPhoneNumber": "+19193234088",
    "destinationPhoneNumber": "+19198675309",
    "calls": [
      {
        "event_type": "call.hangup",
        "id": "cddecb2a-bb3c-4e90-8e85-e1b6d51a901b",
        "occurred_at": "2021-01-26T16:00:55.413407Z",
        "payload": {
            "call_control_id": "v2:GegDKN9TMwSPYwUALiLrqNd-TpfER6QgvvNg49reRPtz6mhrhBiTTg",
            "call_leg_id": "a704d6e6-5fef-11eb-9e5f-02420a0f7568",
            "call_session_id": "a704df56-5fef-11eb-9718-02420a0f7568",
            "client_state": null,
            "connection_id": "1557657082730120568",
            "end_time": "2021-01-26T16:00:55.413407Z",
            "from": "+14154886792",
            "hangup_cause": "normal_clearing",
            "hangup_source": "caller",
            "sip_hangup_cause": "200",
            "start_time": "2021-01-26T16:00:46.873401Z",
            "to": "+19193234088"
          },
          "record_type": "event"
      }
    ]
  }
]
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Call tracking follow-Ons

Now that you've successfully built a call tracking application, you can explore more features and discover ideas to build new applications.

Our <a href="https://joinslack.telnyx.com/">developer Slack community</a> is full of Node developers like you - be sure to join to see what your fellow developers are building!
