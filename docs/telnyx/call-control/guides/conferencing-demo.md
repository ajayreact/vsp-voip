---
title: "Conferencing"
source_url: "https://developers.telnyx.com/docs/voice/programmable-voice/conferencing-demo.md"
category: "call-control"
synced_at: "2026-06-25T18:43:05.873Z"
content_hash: "b29e89a7d8406eb0caf798cc9c2d403fc820d86627745bb68eede3d0529be1bf"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Conferencing Demo

> How to build a conferencing using Telnyx Voice API. Start building on Telnyx today.

\| [Python](#python) | [PHP](#php) | [Node](#node) | [Ruby](#ruby) |

***

## Python

⏱ **60 minutes build time || <a href="https://github.com/team-telnyx/python-conferencing-demo">Github Repo</a>**

### Introduction

The [Voice API framework](/api-reference/call-commands/dial), previously called Call Control, is a set of APIs that allow complete control of a call flow from the moment a call begins to the moment it is completed. In between, you will receive a number of [webhooks](/docs/voice/programmable-voice/receiving-webhooks) for each step of the call, allowing you to act on these events and send commands using the Telnyx Library. A subset of the operations available in the Voice API is the [Conference](/api-reference/conference-commands/conference-recording-start) API. This allows the user (you) to create and manage a conference programmatically upon receiving an incoming call, or when initiating an outgoing call.

The <a href="https://github.com/team-telnyx/telnyx-python">Telnyx Python Library</a>
is a convenient wrapper around the Telnyx REST API. It allows you to access and control call flows using an intuitive object-oriented library. This tutorial will walk you through creating a simple Flask and Ngrok server application that allows you to create and manage a conference.

### Setup

This tutorial assumes you've already [set up your developer account and environment](/development) and you know how to [send commands](/docs/voice/programmable-voice/sending-commands) and [receive webhooks](/docs/voice/programmable-voice/receiving-webhooks) using the Telnyx Voice API.

* make sure the *Webhook API Version* is **API v2**

You’ll also need to have `python` installed to continue. You can check this by running the following:

```bash theme={null}
$ python3 -v
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Now in order to receive the necessary webhooks for our IVR, we will need to set up a server. For this tutorial, we will be using <a href="https://palletsprojects.com/p/flask/">Flask</a>, a micro web server framework. A quickstart guide to flask can be found on their official website. For now, we will install flask using pip.

```bash theme={null}
$ pip install flask
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

You can get the full set of available Telnyx Voice API Commands [here](/api-reference/call-commands/dial).
You can also find the Conference Commands [here](/api-reference/conference-commands/conference-recording-start)

For each Telnyx Voice API Command we will be using the Telnyx Python SDK. To execute this API we are using Python `telnyx`, so make sure you have it installed. If not you can install it with the following command:

```bash theme={null}
$ pip install telnyx
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

After that you’ll be able to use ‘telnyx’ as part of your app code as follows:

```python theme={null}
import telnyx
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

We will also import Flask in our application as follows:

```python theme={null}
from flask import Flask, request, Response
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

And set our api key using the Python telnyx SDK:

```python theme={null}
telnyx.api_key = "YOUR_TELNYX_API_KEY"
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Server and Webhook setup

Flask is a great application for setting up local servers. However, in order to make our code public to be able to receive webhooks from Telnyx, we are going to need to use a tool called ngrok. Installation instructions can be found [here](/development/development-tools/ngrok-setup/index#ngrok).

Now to begin our flask application, underneath the import and setup lines detailed above, we will add the following:

```python theme={null}
app = Flask(__name__)
 
@app.route('/webhook', methods=['POST'])
def respond():
	//Our code for handling the call control application will go here
	print(request.json[‘data’])
return Response(status=200)
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

This is the base Flask application code specified by their <a href="https://palletsprojects.com/p/flask/">documentation</a>. This is the minimum setup required to receive webhooks and manipulate the information received in json format. To complete our setup, we must run the following to set up the Flask environment (note YOUR\_FILE\_NAME will be whatever you .py file is named):

```bash theme={null}
$ export FLASK_APP=YOUR_FILE_NAME.py
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Now, we are ready to serve up our application to our local server. To do this, run:

```bash theme={null}
$ flash run
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

A successful output log should look something like:

```bash theme={null}
 * Serving Flask app "main"
 * Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Now that our Flask application is running on our local server, we can use ngrok to make this public to receive webhooks from Telnyx by running the following command wherever the ngrok executable is located (NOTE you may have to open another terminal window or push the Flask process to the background):

```bash theme={null}
$ ./ngrok http 5000
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Once this is up and running, you should see the output URL in the command logs or located on the <a href="https://dashboard.ngrok.com/login">ngrok dashboard page</a>. This url is important because it will be where our Voice API Application will be sending webhooks to. Grab this url and head on over to the Telnyx Dashboard page. Navigate to your Voice API Application and add the URL to the section labeled "Send a webhook to the URL" as shown below. Add the ngrok url to that section and we are all set up to start our IVR!

**Ensure that you append '/webhook' to the ngrok url as specified in our Flask Application**

![URL Webhook Section](https://images.ctfassets.net/4b49ta6b3nwj/5fWNOgoZnSwcSj28O1B5Ld/f951a6c0b7118f3a27d86aa5d5035d5e/call_control_url_webhook.PNG)

### Receiving and interpreting Webhooks

We will be configuring our respond function to handle certain incoming webhooks and execute Voice API commands based on what the values are. Flask catches the incoming webhooks and calls the respond() function every time a webhook is sent to the route we specified as ‘/webhook’. We can see the json value of the hook in the request.json object. Here is what a basic Telnyx Call Object looks like

```json theme={null}
{
	'data': {
		'event_type': 'call.initiated',
		'id': 'a2fa3fa6-4e8c-492d-a7a6-1573b62d0c56',
		'occurred_at': '2020-07-10T05:08:59.668179Z',
		'payload': {
			'call_control_id': 'v2:rcSQADuW8cD1Ud1O0YVbFROiQ0_whGi3aHtpnbi_d34Hh6ELKvLZ3Q',
			'call_leg_id': '76b31010-c26b-11ea-8dd4-02420a0f6468',
			'call_session_id': '76b31ed4-c26b-11ea-a811-02420a0f6468',
			'caller_id_name': '+17578390228',
			'client_state': None,
			'connection_id': '1385617721416222081',
			'direction': 'incoming',
			'from': '+14234567891',
			'start_time': '2020-07-10T05:08:59.668179Z',
			'state': 'parked',
			'to': '+12624755500'
		},
		'record_type': 'event'
	},
	'meta': {
		'attempt': 1,
		'delivered_to': 'http://59d6dec27771.ngrok.io/webhook'
	}
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

We want to first check and see if the incoming webhook is an event. To check that, we need to look at the record\_type using the following check:

```python theme={null}
def respond():
	//Check record_type of object
	data = request.json['data']
    	if data.get('record_type') == 'event':
 
	print(request.json[‘data’])
return Response(status=200)
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Then, we can check and see what kind of event it is. In the case of the example json above, the event is call.initiated. We can get that value using the following added code:

```python theme={null}
def respond():
	//Check record_type of object
	data = request.json['data']
    	if data.get('record_type') == 'event':
		//Check event type
		event = data.get('event_type')
        	print(event, flush=True)
        	if event == "call.initiated":
            	print("Incoming call", flush=True)
 
	print(request.json[‘data’])
return Response(status=200)
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

As you can see, this check will print out “incoming call” whenever a call.initiated event is received by our application. We can even test it by giving the Phone Number associated with our Voice API Application a call! Now we can start to implement some commands in response to this webhook.

### Receiving Webhooks & creating a conference

Below is the logic that will go inside our respond() function. When we receive a webhook, we extract the data from `request.json.get('data')` and we look at the `event_type` inside that object to determine a course of action.

```python theme={null}
calls = []
conference = None

class call_info:
    call_control_id: ''
    call_leg_id: ''

@app.route('/webhook', methods=['POST'])
def respond():

    # Activate global calls array
    global calls
    global conference

    # Get the data from the request
    data = request.json.get('data')
    # Check record_type
    if data.get('record_type') == 'event':
        # Check event type
        event = data.get('event_type')
        if event == "call.initiated":
            # Extract call information and store it in a new call_info() object
            new_call = call_info()
            new_call.call_control_id = data.get('payload').get('call_control_id')
            new_call.call_leg_id = data.get('payload').get('call_leg_id')
            calls.append(new_call)
            # Answer the call
            print(telnyx.Call.answer(new_call), flush=True)

        # When the call is answered, find the stored call and either add it 
        # to the conference or create a new one if one is not yet created
        elif event == "call.answered":
            call_id = data.get('payload').get('call_control_id')
            call_created = call_info()
            call_created.call_control_id = call_id

            for call in calls:
                if call.call_control_id == call_id:
                    if not conference:
                        conference = telnyx.Conference.create(beep_enabled="always",call_control_id=call_id, name="demo-conference")
                    else:
                        conference.join(call_control_id=call_id)
        
        # When a caller hangs up, remove that caller from the global calls array
        elif event == "call.hangup":
            call_id = data.get('payload').get('call_leg_id')
            for call in calls:
                if call.call_leg_id == call_id:
                    calls.remove(call)
    return Response(status=200)
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Pat youself on the back - that's a lot of code to go through! Now let's break it down even further and explain what it does. First, create an array for keeping track of the ongoing calls and define a variable for storing the conference object. Then, we create a small object class for call\_info, containing the call\_control\_id and call\_leg\_id. This will be useful for searching for calls in our calls array later, as well as using Conference Commands with those objects.

```python theme={null}
calls = []
conference = None

class call_info:
    call_control_id: ''
    call_leg_id: ''
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Next, we parse the data from our webhook in the respond() function. We first declare our global variables inside of the function so that the scope is consistent. Then, we extract the data from the reponse and check to ensure the `record_type` is `event`. Then, we extract the `event_type` itself and use logic to determine the action taken based on the `event`.

```python theme={null}
@app.route('/webhook', methods=['POST'])
def respond():
    # Activate global calls array
    global calls
    global conference
    # Get the data from the request
    data = request.json.get('data')
    #print(data, flush=True) #For testing purposes, you could print out the data object received
    # Check record_type
    if data.get('record_type') == 'event':
        # Check event type
        event = data.get('event_type')
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Here is where you will respond to a new call being initiated, which can be from either an inbound or outbound call. We create a new call\_info() object and assign the `call_control_id` and `call_leg_id` from the incoming data. We then use `telnyx.Call.answer(new_call)` to answer the call. This will trigger a webhook event `call.answered` which we will handle below.

```python theme={null}
# When call is initiated, create the new call object and add it to the calls array
        if event == "call.initiated":
            # Extract call information and store it in a new call_info() object
            new_call = call_info()
            new_call.call_control_id = data.get('payload').get('call_control_id')
            new_call.call_leg_id = data.get('payload').get('call_leg_id')
            calls.append(new_call)
            # Answer the call
            print(telnyx.Call.answer(new_call), flush=True)
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

On the `call.answered` event, retrieve the stored call created during the `call.initiated` event. Then, either create a new conference if this is the first call and there isn't a conference running yet, or add the call to an existing conference. Note that a `call_control_id` is required to start a conference, so there must aready be an existing call before you can create a conference, which is why we create the conference here.

```ruby theme={null}
# When the call is answered, find the stored call and either add it 
        # to the conference or create a new one if one is not yet created
        elif event == "call.answered":
            call_id = data.get('payload').get('call_control_id')
            call_created = call_info()
            call_created.call_control_id = call_id

            for call in calls:
                if call.call_control_id == call_id:
                    if not conference:
                        conference = telnyx.Conference.create(beep_enabled="always",call_control_id=call_id, name="demo-conference")
                    else:
                        conference.join(call_control_id=call_id)
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

And finally, when a call ends we remove it from the active call list.

```python theme={null}
# When a caller hangs up, remove that caller from the global calls array
        elif event == "call.hangup":
            call_id = data.get('payload').get('call_leg_id')
            for call in calls:
                if call.call_leg_id == call_id:
                    calls.remove(call)
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Conclusion

The full tutorial with comments can be found <a href="https://github.com/team-telnyx/python-conferencing-demo">on Github</a>.

## PHP

⏱ **60 minutes build time || <a href="https://github.com/team-telnyx/demo-conference-php">Github Repo</a>**

### Introduction

The [Voice API framework](/api-reference/call-commands/dial), previously called Call Control, is a set of APIs that allow complete control of a call flow from the moment a call begins to the moment it is completed. In between, you will receive a number of [webhooks](/docs/voice/programmable-voice/receiving-webhooks) for each step of the call, allowing you to act on these events and send commands using the Telnyx Library. A subset of the operations available in the Telnyx Voice API is the [Conference](/api-reference/conference-commands/conference-recording-start) API. This allows the user (you) to create and manage a conference programmatically upon receiving an incoming call, or when initiating an outgoing call.

The <a href="https://github.com/team-telnyx/telnyx-php">Telnyx PHP Library</a>
is a convenient wrapper around the Telnyx REST API. It allows you to access and control call flows using an intuitive object-oriented library. This tutorial will walk you through creating a simple <a href="https://www.slimframework.com/">Slim</a> server that allows you to create and manage a conference.

### What can you do

At the end of this tutorial you'll have an application that:

* Verifies inbound webhooks are indeed from Telnyx
* Creates a conference for the first caller
* Adds additional callers to the existing conference
* Tears down the conference when the last call leaves
* Will create a new conference when the next caller dials in

### Setup

Before beginning, please setup ensure that you have <a href="https://getcomposer.org/">composer</a> installed.

#### Install packages

```bash theme={null}
composer require slim/slim:^4.0
composer require slim/http
composer require slim/psr7
composer require telnyx/telnyx-php
composer require vlucas/phpdotenv
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

This will create `composer.json` file with the packages needed to run the application.

This tutorial assumes you've already [set up your developer account and environment](/development) and you know how to [send commands](/docs/voice/programmable-voice/sending-commands) and [receive webhooks](/docs/voice/programmable-voice/receiving-webhooks) using the Telnyx Voice API.

The <a href="https://portal.telnyx.com/#/app/call-control/applications">Voice API Application</a>
needs to be setup to work with the conference control api:

* make sure the *Webhook API Version* is **API v2**
* Fill in the *Webhook URL* with the address the server will be running on. Alternatively, you can use a service like [ngrok](/development/development-tools/ngrok-setup/index#ngrok) to temporarily forward a local port to the internet to a random address and use that. We'll talk about this in more detail later.

Finally, you need to create an <a href="https://portal.telnyx.com/#/app/auth/v2">API Key</a> - make sure you save the key somewhere safe.

#### Setting environment variables

This tutorial uses the excellent <a href="https://github.com/vlucas/phpdotenv">phpenv</a> package to manage environment variables.

Create a `.env` file in your root directory to contain your API & Public key. **BE CAREFUL TO NOT SHARE YOUR KEYS WITH ANYONE** Recommended to add `.env` to your `.gitignore` file.

Your `.env` file should look something like:

```
TELNYX_API_KEY="KEYABC123_ZXY321"
TELNYX_PUBLIC_KEY="+lorem/ipsum/lorem/ipsum="
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Code-along

Now create a folder `public` and a file in the public folder`index.php`, then write the following to setup the telnyx library.

```bash theme={null}
mkdir public
touch public/index.php
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### Setup slim server and instantiate Telnyx

```php theme={null}
<?php

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Factory\AppFactory;
use Telnyx;

require __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__, '../.env');
$dotenv->load();

$TELNYX_API_KEY    = $_ENV['TELNYX_API_KEY'];
$TELNYX_PUBLIC_KEY = $_ENV['TELNYX_PUBLIC_KEY'];
$CONFERENCE_FILE_NAME = '../conference_id.txt';

Telnyx\Telnyx::setApiKey($TELNYX_API_KEY);
Telnyx\Telnyx::setPublicKey($TELNYX_PUBLIC_KEY);

// Instantiate Slim App
$app = AppFactory::create();

// Add error middleware
$app->addErrorMiddleware(true, true, true);
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

📝 *Note* the `$CONFERENCE_FILE_NAME = '../conference_id.txt';` will be used to track conference state.

### Receiving Webhooks & creating a conference

Now that you have setup your auth token, phone number, and connection, you can begin to use the API Library to make and control conferences. First, you will need to setup a Slim endpoint to receive webhooks for call and conference events.

There are a number of webhooks that you should anticipate receiving during the lifecycle of each call and conference. This will allow you to take action in response to any number of events triggered during a call. In this example, you will use the `call.initiated`, `call.answered`, and `conference.ended` events to add calls to a conference and tear it down. Because you will need to wait until there is a running call before you can create a conference, plan to use call events to create the conference after a call is initiated.

#### Basic routing & functions

The basic overview of the application is as follows:

1. Verify webhook & create TelnyxEvent
2. Check event-type and route to the event handler
3. `call.initiated` events are answered
4. `call.answered` events check if there is a conference, if so; join, if not, create new conference
5. `conference.ended` will tear down the existing conference making way for a new one.

#### Webhook validation middleware

Telnyx signs each webhook that can be validated by checking the signature with your public key. This example adds the verification step as middleware to be included on all Telnyx endpoints.

```php theme={null}
//Callback signature verification
$telnyxWebhookVerify = function (Request $request, RequestHandler $handler) {
    //Extract the raw contents
    $payload = $request->getBody()->getContents();
    //Grab the signature
    $sigHeader = $request->getHeader('HTTP_TELNYX_SIGNATURE_ED25519')[0];
    //Grab the timestamp
    $timeStampHeader = $request->getHeader('HTTP_TELNYX_TIMESTAMP')[0];
    //Construct the Telnyx event which will validate the signature and timestamp
    $telnyxEvent = \Telnyx\Webhook::constructEvent($payload, $sigHeader, $timeStampHeader);
    //Add the event object to the request to keep context for future middleware
    $request = $request->withAttribute('telnyxEvent', $telnyxEvent);
    //Send to next middleware
    $response = $handler->handle($request);
    //return response back to Telnyx
    return $response;
};
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

ℹ️ For more details on middleware see <a href="https://www.slimframework.com/docs/v4/objects/routing.html#route-middleware">Slim's documentation on Route Middleware</a>

#### Conference management

For each call, we need to check if there is already a conference. In a more sophisticated application this would typically be solved by a connection to any given data store. For this demo, we're managing the state in a file on disc `$CONFERENCE_FILE_NAME`.

```php theme={null}
// Read the ID out of the file, if doesn't exist return FALSE
function readConferenceFile (String $CONFERENCE_FILE_NAME) {
    if (!file_exists($CONFERENCE_FILE_NAME)) {
        return FALSE;
    }
    else {
        $conferenceFile = fopen($CONFERENCE_FILE_NAME, 'r') or die("Unable to open file!");
        $fileConferenceId = fread($conferenceFile, filesize($CONFERENCE_FILE_NAME));
        return $fileConferenceId;
    }
}

// Create the conference Id file and write the ID to disc
function createConferenceFile (String $conferenceId, String $CONFERENCE_FILE_NAME) {
    $conferenceFile = fopen($CONFERENCE_FILE_NAME, 'w') or die ('Unable to open conference file');
    fwrite($conferenceFile, $conferenceId);
    fclose($conferenceFile);
    return $conferenceId;
};

// Delete the file; making way for a new conference to be created for next caller
function deleteConferenceFile (String $CONFERENCE_FILE_NAME){
    if (!file_exists($CONFERENCE_FILE_NAME)) {
        return;
    }
    if (!unlink($CONFERENCE_FILE_NAME)) {
        die ('Can not delete conference file');
    }
    return;
};
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### Event Handlers and switch

For each event (besides `call.initiated` we need to check the current state of the conference before making next steps)

```php theme={null}
//Adds the given call to the conference
function addCallToConference (String $callControlId, String $conferenceId) {
    $conference = new Telnyx\Conference($conferenceId);
    $joinConferenceParameters = array(
        'call_control_id' => $callControlId
    );
    $conference->join($joinConferenceParameters);
};

// creates a conference and creates the conference state file
function createConference (String $callControlId, String $CONFERENCE_FILE_NAME) {
    $conferenceName = uniqid('conf-');
    $conferenceParameters = array(
        'call_control_id' => $callControlId,
        'name' => $conferenceName,
        'beep_enabled' => 'always'
    );
    $newConference = Telnyx\Conference::create($conferenceParameters);
    $conferenceId = $newConference->id;
    createConferenceFile($conferenceId, $CONFERENCE_FILE_NAME);
    return $conferenceId;
}

// Speaks to our caller then determines whether to create a new conference or add to existing
function handleAnswer (String $callControlId, String $CONFERENCE_FILE_NAME) {
    $speakParams = array(
        'payload' => 'joining conference',
        'voice' => 'female',
        'language' => 'en-GB'
    );
    $call = new Telnyx\Call($callControlId);
    $call->speak($speakParams);
    $existingConferenceId = readConferenceFile($CONFERENCE_FILE_NAME);
    if (!$existingConferenceId) {
        createConference($callControlId, $CONFERENCE_FILE_NAME);
    }
    else {
        addCallToConference($callControlId, $existingConferenceId);
    }
    return;
};

// Add route
$app->post('/Callbacks/Voice/Inbound', function (Request $request, Response $response) {
    global $CONFERENCE_FILE_NAME;
    // Get the parsed event from the request
    $telnyxEvent = $request->getAttribute('telnyxEvent');
    // Extract the relevant information
    $data = $telnyxEvent->data;
    // Only _really_ care about events right now
    if ($data['record_type'] != 'event') {
        return $response->withStatus(200);
    }
    $callControlId = $data->payload['call_control_id'];
    $event = $data['event_type'];
    switch ($event) {
        case 'call.initiated':
            // Create a new call object
            $call = new Telnyx\Call($callControlId);
            // Then answer it
            $call->answer();
            break;
        case 'call.answered':
            handleAnswer($callControlId, $CONFERENCE_FILE_NAME);
            break;
        case 'conference.ended':
            deleteConferenceFile($CONFERENCE_FILE_NAME);
        default:
            # other events less importante right now
            break;
    }
    // Let's play nice and return 200
    return $response->withStatus(200);
})->add($telnyxWebhookVerify);

// run the thing!
$app->run();
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Usage

Start the server `php -S localhost:8000 -t public`

When you are able to run the server locally, the final step involves making your application accessible from the internet. So far, we've set up a local web server. This is typically not accessible from the public internet, making testing inbound requests to web applications difficult.

The best workaround is a tunneling service. They come with client software that runs on your computer and opens an outgoing permanent connection to a publicly available server in a data center. Then, they assign a public URL (typically on a random or custom subdomain) on that server to your account. The public server acts as a proxy that accepts incoming connections to your URL, forwards (tunnels) them through the already established connection and sends them to the local web server as if they originated from the same machine. The most popular tunneling tool is `ngrok`. Check out the [ngrok setup](/development/development-tools/ngrok-setup/index#ngrok) walkthrough to set it up on your computer and start receiving webhooks from inbound messages to your newly created application.

Once you've set up `ngrok` or another tunneling service you can add the public proxy URL to your Connection in the Mission Control Portal. To do this, click  the edit symbol \[✎] next to your Connection. In the "Webhook URL" field, paste the forwarding address from ngrok into the Webhook URL field. Add `/Callbacks/Voice/Inbound` to the end of the URL to direct the request to the webhook endpoint in your slim-php server.

For now you'll leave “Failover URL” blank, but if you'd like to have Telnyx resend the webhook in the case where sending to the Webhook URL fails, you can specify an alternate address in this field.

### Complete Running Voice API Conference Application

The <a href="https://github.com/team-telnyx/demo-conference-php">Github Repo</a> contains an extended version of the tutorial code above ready to run.

## Node

⏱ **60 minutes build time || <a href="https://github.com/team-telnyx/demo-conference-node">Github Repo</a>**

Telnyx Conference System demo built on Voice API V2 and node.js.

In this tutorial, you’ll learn how to:

1. Set up your development environment to use Telnyx Voice API using Node.
2. Build a simple Telnyx Voice API Conference System using Node.

***

* [Prerequisites](#prerequisites)
* [Telnyx Voice API Basics](#get-started-with-telnyx-call-control)

  * [Understanding the Command Syntax](#understanding-the-command-syntax)
  * [Telnyx Voice API Basic Set](#telnyx-call-control-basic-set)
  * [Telnyx Voice API Conference Commands](#telnyx-call-control-conference-commands)
* [Building a Conference System](#building-a-conference-system)
* [Interacting with the Conference Room](#interacting-with-the-conference-room)
* [Lightning-Up the Application](#lightning-up-the-application)

***

### Prerequisites

This tutorial assumes you've already [set up your developer account and environment](/development) and you know how to [send commands](/docs/voice/programmable-voice/sending-commands) and [receive webhooks](/docs/voice/programmable-voice/receiving-webhooks) using the Telnyx Voice API.

You’ll also need to have `node` installed to continue. You can check this by running the following:

```bash theme={null}
$ node -v
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

If Node isn’t installed, follow the <a href="https://nodejs.org/en/download">official installation instructions</a> for your operating system to install it.

You’ll need to have the following Node dependencies installed for the Telnyx Voice API:

```javascript theme={null}
import express from 'express';
import superagent from 'superagent';
import fs from 'fs';
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Get started with Telnyx Voice API

For the Voice API application you’ll need to get a set of basic functions to perform Telnyx Voice API Commands plus Telnyx Voice API Conference specifics.

This tutorial will be using the following subset of basic Telnyx Voice API Commands:

* [Voice API Answer](/api-reference/call-commands/answer-call)
* [Voice API Hangup](https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/hangup/index#hangup)
* [Voice API Speak](/api-reference/call-commands/speak-text)
* [Voice API Dial](/api-reference/call-commands/dial)

Plus all the Telnyx Voice API Conference Commands:

* [Voice API Join Conference](/api-reference/conference-commands/join-a-conference)
* [Voice API Mute Conference Participant](/api-reference/conference-commands/mute-conference-participants)
* [Voice API Unmute Conference Participant](/api-reference/conference-commands/unmute-conference-participants)
* [Voice API Hold Conference Participant](/api-reference/conference-commands/hold-conference-participants)
* [Voice API Unhold Conference Participant](/api-reference/conference-commands/unhold-conference-participants)

You can get the full set of available Telnyx Voice API Commands [here](/api-reference/call-commands/dial).

For each Telnyx Voice API Command we will be creating a function that will execute an `HTTP POST` Request to back to Telnyx server. To execute this API we are using `superagent`, so make sure you have it installed. If not you can install it with the following command:

```bash theme={null}
$ npm install superagent --save
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

After that you’ll be able to use ‘superagent’ as part of your app code as follows:

```javascript theme={null}
import superagent from 'superagent';
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

To make use of the Telnyx Voice API Command API you’ll need to set a Telnyx API Key.

To check that go to Mission Control Portal and under the `Auth` tab you select `Auth V2`. There you'll find credentials for `Auth v2 API Keys`. Click on `Create API Key` and save the key that is shown to you. Please store it as you wont be able to fetch it later.

Once you have it, you can include it on the <a href="https://github.com/team-telnyx/demo-conference-node/blob/master/api-v2/telnyx-account-v2.json">telnyx-account-v2.json</a> file.

```javascript theme={null}
"telnyx_api_auth_v2": "<your-api-v2-key-here>"
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

This application will also make use of a hosted audio file for the waiting tone while on [hold](/api-reference/conference-commands/hold-conference-participants):

```javascript theme={null}
"telnyx_waiting_url": "<your-path-to-waiting-song-here>"
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

As well as the ID of the Voice API Application for the [Dial](/api-reference/call-commands/dial) command:

```javascript theme={null}
"telnyx_connection_id": "<your-call-control-application-id>"
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

You can find the Voice API ID in the Mission Portal by editing the Voice API Application being used:

![Finding the Voice API ID for a Voice API Application](https://images.ctfassets.net/4b49ta6b3nwj/3QSrrdNoH5ar5hvnu3H2fY/fe52cb157da846063c26501647f76441/call-control-id.png)

Once all dependencies are set, we can create a function for each Telnyx Voice API Command. All Commands will follow the same syntax:

```javascript theme={null}
function call_control_COMMAND_NAME(f_call_control_id, f_INPUT1, ...){
  const cc_action = ‘COMMAND_NAME’;

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/calls/${f_call_control_id}/actions/${cc_action}`)
    .send({ PARAM1: f_INPUT1 });

  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Understanding the Command Syntax

There are several aspects of this function that deserve some attention:

* `Function Input Parameters`: to execute every Telnyx Voice API Command you’ll need to feed your function with the following:

  * the `Call Control ID`
  * the input parameters, specific to the body of the Command you’re executing.

Having these set as function input parameters will make it generic enough to reuse for different use cases:

```javascript theme={null}
function call_control_COMMAND_NAME(f_call_control_id, f_INPUT)
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

All Telnyx Voice API Commands will be expecting the `Call Control ID` except `Dial`. There you’ll get a new one for the leg generated as response.

* `Name of the Call Control Command`: as detailed [here](/api-reference/call-commands/dial), the Command name is part of the API URL. In our code we call that the `action` name, and will feed the POST Request URL later:

```javascript theme={null}
const cc_action = ‘COMMAND_NAME’
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

* `Building the Telnyx Call Control Command`: once you have the Command name defined, you should have all the necessary info to build the complete Telnyx Voice API Command:

```javascript theme={null}
  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/calls/${f_call_control_id}/actions/${cc_action}`)
    .send({ PARAM1: f_INPUT1 });
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

```
In this example, you can see that the `Call Control ID` and the Action name will feed the URL of the API. The Telnyx API Key is passed to the Authentication header, and the body is formed with all of the different input parameters received for that specific Command.
```

* `Calling the Telnyx Call Control Command`: Having the request `headers` and `options`/`body` set, the only thing left is to execute the `POST Request` to run the command. For that we are making use of node's `request` module:

```javascript theme={null}
  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Telnyx Voice API basic set

This is how every Telnyx Voice API Command used in this application looks:

#### Voice API answer

```javascript theme={null}
function call_control_answer_call(f_telnyx_api_auth_v2, f_call_control_id, f_client_state_s) {
  const l_cc_action = 'answer';
  const l_client_state_64 = null;

  if (f_client_state_s) {
    l_client_state_64 = Buffer.from(f_client_state_s).toString('base64');
  }

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/calls/${f_call_control_id}/actions/${l_cc_action}`)
    .send({ client_state: l_client_state_64 });

  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### Voice API hangup

```javascript theme={null}
function call_control_hangup(f_telnyx_api_auth_v2, f_call_control_id) {
  const l_cc_action = 'hangup';

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/calls/${f_call_control_id}/actions/${l_cc_action}`)
    .send({});

  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### Voice API dial

```javascript theme={null}
function call_control_dial(f_telnyx_api_auth_v2, f_dest, f_from, f_connection_id) {
  const l_cc_action = 'dial';

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/calls/${f_call_control_id}/actions/${l_cc_action}`)
    .send({
      to: f_dest,
      from: f_from,
      connection_id: f_connection_id,
    });

  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### Voice API speak

```javascript theme={null}
function call_control_speak(f_telnyx_api_auth_v2, f_call_control_id, f_tts_text) {
  const l_cc_action = 'speak';

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/calls/${f_call_control_id}/actions/${l_cc_action}`)
    .send({
      payload: f_tts_text,
      voice: g_ivr_voice,
      language: g_ivr_language,
    });

  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### Voice API recording start

```javascript theme={null}
function call_control_record_start(f_telnyx_api_auth_v2, f_call_control_id) {
  const l_cc_action = 'record_start';

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/calls/${f_call_control_id}/actions/${l_cc_action}`)
    .send({
      format: 'mp3',
      channels: 'dual'
    });

  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### Voice API recording stop

```javascript theme={null}
function call_control_record_stop(f_telnyx_api_auth_v2, f_call_control_id) {
  const cc_action = 'record_stop';

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/calls/${f_call_control_id}/actions/${cc_action}`)
    .send({});

  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Telnyx Voice API Conference Commands

This is what every Telnyx Voice API Conference Commands look like:

#### Conference: create conference

```javascript theme={null}
function call_control_create_conf(f_telnyx_api_auth_v2, f_call_control_id, f_client_state_s, f_name, f_callback) {
  const cc_action = 'create_conf';
  const l_client_state_64 = null;

  if (f_client_state_s) {
    l_client_state_64 = Buffer.from(f_client_state_s).toString('base64');
  }

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/calls/${f_call_control_id}/actions/${cc_action}`)
    .send({
      call_control_id: f_call_control_id,
      name: f_name,
      client_state: l_client_state_64
    });

  request
    .then((response) => {
      const body = response.body;
      if (body.data) f_callback(null, body.data.id);
    })
    .catch((error) => {
      console.log(error);
      f_callback(err);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### Conference: Join conference

```javascript theme={null}
function call_control_join_conf(f_telnyx_api_auth_v2, f_call_control_id, f_conf_id, f_client_state_s) {
  const cc_action = 'join';
  const l_client_state_64 = null;

  if (f_client_state_s) {
    l_client_state_64 = Buffer.from(f_client_state_s).toString('base64');
  }

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/calls/${f_call_control_id}/actions/${cc_action}`)
    .send({
      call_control_id: f_call_control_id,
      client_state: l_client_state_64
    });

  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### Conference: Mute participant

```javascript theme={null}
function call_control_mute(f_telnyx_api_auth_v2, f_conf_id, f_call_control_ids) {
  const cc_action = 'mute';

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/conferences/${f_conf_id}/actions/${cc_action}`)
    .send({
      call_control_ids: f_call_control_ids,
    });

  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### Conference: Unmute participant

```javascript theme={null}
function call_control_unmute(f_telnyx_api_auth_v2, f_conf_id, f_call_control_ids) {
  const cc_action = 'unmute';

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/conferences/${f_conf_id}/actions/${cc_action}`)
    .send({
      call_control_ids: f_call_control_ids,
    });

  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### Conference: Hold participant

```javascript theme={null}
function call_control_hold(f_telnyx_api_auth_v2, f_conf_id, f_call_control_ids, f_audio_url) {
  const cc_action = 'hold';

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/conferences/${f_conf_id}/actions/${cc_action}`)
    .send({
      call_control_ids: f_call_control_ids,
      audio_url: f_audio_url
    });

  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### Conference: Unhold participant

```javascript theme={null}
function call_control_unhold(f_telnyx_api_auth_v2, f_conf_id, f_call_control_ids, f_audio_url) {
  const cc_action = 'unhold';

  const request = superagent
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${f_telnyx_api_auth_v2}`)
    .post(`https://api.telnyx.com/v2/conferences/${f_conf_id}/actions/${cc_action}`)
    .send({
      call_control_ids: f_call_control_ids,
      audio_url: f_audio_url
    });

  request
    .then((response) => {
      const body = response.body;
    })
    .catch((error) => {
      console.log(error);
    });
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

`Client State`: within some of the Telnyx Voice API Commands list we presented, you probably noticed we were including the `Client State` parameter. `Client State` is the key to ensure that we can have several levels on our IVR while consuming the same Voice API Events.

Because Voice API is stateless and async, your application will be receiving several events of the same type, e.g. user just included `DTMF`. With `Client State` you enforce a unique ID to be sent back to Telnyx which can be used within a particular Command flow, identifying it as being at Level 2 of a certain IVR for example.

### Building a conference system

With all the basic and conference related Telnyx Voice API Commands set, we are ready to put them in the order that will create a simple Conference System. For that all we are going to do is to:

1. handle incoming calls and place participants in the conference
2. push for outgoing calls and place participants in the conference
3. maintain a participant list
4. greet the new participants before place them on the conference room
5. put the first participant automatically on hold
6. put a participant on-hold every-time he's the only participant on the conference room
7. un-hold the unique participant on the conference room when the second arrives
8. allow remote commands to list participants, force hold/unhold, force mute/unmute, force participant push

To exemplify this process we created a simple API call that will be exposed as the webhook in Mission Portal. For that we would be using `express`:

```bash theme={null}
$ npm install request --save
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

With `express` we can create an API wrapper that uses `HTTP POST` to call our Request Token method:

```javascript theme={null}
rest.post('/'+g_appName+'/start', function (req, res) {
  // APP CODE GOES HERE
})
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

This would expose a webhook like the following:

```
https://<webhook_domain>:8081/telnyx-conf/start
```

You probably noticed that `g_appName` in  the previous point. That is part of a set of global variables we are defining with a certain set of info we know we are going to use in this app: TTS parameters, like voice and language to be used, etc...

For the purpose of maintaining the Conference list and state of the Conference room we also define a set of global variables.

You can set these at the beginning of your code:

```javascript theme={null}
// Application:
const g_appName = "telnyx-conf-v2";

// TTS Options
const g_ivr_voice     = 'female';
const g_ivr_language = 'en-GB';

// Conf Options
const g_conf_id = 'no-conf';
const g_on_hold = 'false';
const g_participants = new Map();
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

> If you would like to run the application on your local machine you will have to expose the app to the public internet. To do this you can use `ngrok`. You can follow the setup guide for `ngrok` [here](/development/development-tools/ngrok-setup/index#ngrok).

With that set, we can fill in that space that we named as `APP CODE GOES HERE`. When your webhook URL is ready you can add the webhook URL to your Mission Control Portal Connection associated with your number. Here's an example of what a Voice API setup looks like:

<img src="https://mintcdn.com/telnyx/d2AUJO5qdne_WnZI/img/cc-example-connection.png?fit=max&auto=format&n=d2AUJO5qdne_WnZI&q=85&s=36729a011484d8dda5477c805c3c881f" alt="Mission Control Portal Voice API setup" width="623" height="1084" data-path="img/cc-example-connection.png" />

So the first thing to be done is to identify the kind of event you just received and extract the `Call Control Id` and `Client State`:

```javascript theme={null}
if (req && req.body && req.body.data.event_type) {
    const l_hook_event_type = req.body.data.event_type;
    const l_call_control_id = req.body.data.payload.call_control_id;
    const l_client_state_64 = req.body.data.payload.client_state;
} else{res.end('0');}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Once you identify the `Event Type` received, it’s just a matter of having your application reacting to that. Is the way you react to that Event that helps you creating the IVR logic. What you would be doing is to execute Telnyx Voice API Command as a reaction to those Events.

> For consistency, the Telnyx Voice API engine requires every single Webhook to be replied to by the Webhook end-point, otherwise we will keep trying to send it. For that reason, we have to be ready to consume every Webhook we expect to receive and reply with 200 OK.

#### `Webhook call initiated >> Command answer call`

```javascript theme={null}
    if (req.body.data.payload.direction == 'incoming')
        call_control_answer_call(g_telnyx_api_auth_v2, l_call_control_id, null);
    else
        call_control_answer_call(g_telnyx_api_auth_v2, l_call_control_id, 'outgoing');
    res.end();
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### `Webhook call answered >> Start conference`

Once your app is notified by Telnyx that the call was established you want to either start the conference room or put the participant in an already existing room.

```javascript theme={null}
if (g_conf_id == 'no-conf') {

  // First participant message
  call_control_speak(g_telnyx_api_auth_v2, l_call_control_id,
      'Welcome to this conference demo. ' +
      'Please wait for other participants to join. '
  );

  // Create Conference
  call_control_create_conf(g_telnyx_api_auth_v2, l_call_control_id, 'conf-created', 'myconf', function (conf_err, conf_res) {

      if (conf_res == '0') {
          console.log("[%s] LOG - Conference Creation Failed!", get_timestamp());
          call_control_hangup(g_telnyx_api_auth_v2, l_call_control_id);
      } else {
          g_conf_id = conf_res;

          if (!l_client_state_64)
              g_participants.set(l_call_control_id, l_hook_from); // add inbound participant to the list
          else
              g_participants.set(l_call_control_id, l_hook_to); // add outbound participant to the list
      }

  });

} else {

  // Consequent participants message
  call_control_speak(g_telnyx_api_auth_v2, l_call_control_id,
      'Welcome to this conference demo. ' +
      'We are now putting you on the conference room. '
  );

  call_control_join_conf(g_telnyx_api_auth_v2, l_call_control_id, g_conf_id, 'agent-in');

  // Add Participant to the Participant List
  if (!l_client_state_64)
      g_participants.set(l_call_control_id, l_hook_from); // add inbound participant to the list
  else
      g_participants.set(l_call_control_id, l_hook_to); // add outbound participant to the list
}

res.end();
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### `Conference created >> Just log`

Your app will be informed that the Conference was created.

```javascript theme={null}
console.log("[%s] LOG - New Conference Created! - Conference ID [%s]", get_timestamp(), g_conf_id);
res.end();
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### `Conference join >> Hold/Unhold participant`

Your app will be informed that a participant just joined the room.

```javascript theme={null}
if (g_participants.size < 2) {

  // First Participant
  call_control_hold(g_telnyx_api_auth_v2, g_conf_id, [l_call_control_id], g_telnyx_waiting_url);
  g_on_hold = l_call_control_id;

} else if (g_participants.size == 2) {

  // Second Participant
  call_control_unhold(g_telnyx_api_auth_v2, g_conf_id, [g_on_hold]);
  g_on_hold = 'false';

}
res.end();
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### `Conference Leave >> Remove Participant / Cleanup Vars`

Your app will be informed that a participant just left the room, we need to cleanup some things.

```javascript theme={null}
// Remove participant from the list
g_participants.delete(l_call_control_id);

// Reset Conf_Id if conference room empty
if (g_participants.size < 1) {

  g_conf_id = 'no-conf';

// Put participant back on hold if it's the last one
} else if (g_participants.size == 1) {

  for (let key of g_participants.keys()) {

    // First Participant
    call_control_hold(g_telnyx_api_auth_v2, g_conf_id, [key], g_telnyx_waiting_url);
    g_on_hold = key;
  }
}

res.end();
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### `Anything Else >> Just Ack/200ok`

```javascript theme={null}
} else if (l_hook_event_type == 'call.speak.ended' ||
        l_hook_event_type == 'call.speak.started' ||
        l_hook_event_type == 'playback.ended' ||
        l_hook_event_type == 'call.hangup' ||
        l_hook_event_type == 'gather.ended' ||
        l_hook_event_type == 'call.bridged' ||
        l_hook_event_type == 'dtmf' ||
        l_hook_event_type == 'playback.started') { 
        res.end();

}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Interacting with the conference room

As part of the process of building a Conference Room, there is also the possibility of interacting with the application to list participants and engage with direct participants. We do that by creating a couple of `HTTP GET` commands that can be then called by a browser, cURL or Postman.

#### `Listing participants`

*`https://<webhook_domain>:8081/telnyx-conf-v2/list`*

```javascript theme={null}
rest.get('/' + g_appName + '/list', function (req, res) {

  // Return/Display complete participant list

  if (g_participants.size > 0 && g_conf_id != 'no-conf') {

    let l_list = 'Conference ID: ' + g_conf_id + '\n';
    l_list += '\n';
    l_list += 'Participant List: \n';

    for (let key of g_participants.keys()) {
        l_list += key + ' - [' + g_participants.get(key) + '] \n';
    }

    res.end(l_list);

  } else
    res.end("no participant or no conference exists");
})
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### `Mute participant`

*`https://<webhook_domain>:8081/telnyx-conf-v2/mute?participant=x`*

```javascript theme={null}
rest.get('/' + g_appName + '/mute', function (req, res) {

  // Mute specific Participant

  if (g_participants.size > 0 && g_conf_id != 'no-conf') {

    call_control_mute(g_telnyx_api_auth_v2, g_conf_id, [req.query.participant]);

    res.end("participant muted [" + req.query.participant + "]");

  } else
    res.end("no participant or no conference exists");
})
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### `Unmute participant`

*`https://<webhook_domain>:8081/telnyx-conf-v2/unmute?participant=x`*

```javascript theme={null}
rest.get('/' + g_appName + '/unmute', function (req, res) {

  // Un-Mute specific Participant

  if (g_participants.size > 0 && g_conf_id != 'no-conf') {

    call_control_unmute(g_telnyx_api_auth_v2, g_conf_id, [req.query.participant]);

    res.end("participant unmuted [" + req.query.participant + "]");

  } else
    res.end("no participant or no conference exists");
})
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### `Hold participant`

*`https://<webhook_domain>:8081/telnyx-conf-v2/hold?participant=x`*

```javascript theme={null}
rest.get('/' + g_appName + '/hold', function (req, res) {

  // Put specific participant on-hold

  if (g_participants.size > 0 && g_conf_id != 'no-conf') {

    call_control_hold(g_telnyx_api_key_v1, g_telnyx_api_secret_v1, g_conf_id, [req.query.participant], g_telnyx_waiting_url);

    res.end("participant on hold [" + req.query.participant + "]");

  } else
    res.end("no participant or no conference exists");
})
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### `Unhold participant`

*`https://<webhook_domain>:8081/telnyx-conf-v2/unhold?participant=x`*

```javascript theme={null}
rest.get('/' + g_appName + '/unhold', function (req, res) {

  // Un-hold specific participant

  if (g_participants.size > 0 && g_conf_id != 'no-conf') {

    call_control_unhold(g_telnyx_api_key_v1, g_telnyx_api_secret_v1, g_conf_id, [req.query.participant]);

    res.end("participant resumed [" + req.query.participant + "]");

  } else
    res.end("no participant or no conference exists");
})
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### `Pull participant`

*`https://<webhook_domain>:8081/telnyx-conf-v2/pull?number=x`*

Please note that a URL encoded number format is expected by the webhook, so for international `+E164` numbers we should replace `+` per `%2B`.

Example:

*`https://<webhook_domain>:8081/telnyx-conf-v2/pull?number=%2B35193309090`*

```javascript theme={null}
rest.get('/' + g_appName + '/pull', function (req, res) {

  // Dial-out to specific number to pull participant

  call_control_dial(g_telnyx_api_auth_v2, req.query.number, "conf", g_telnyx_connection_id);
  res.end("called " + req.query.number);
})
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### `Start recording call leg`

*`https://<webhook_domain>:8081/telnyx-conf-v2/record-start?participant=x`*

```javascript theme={null}
rest.get('/' + g_appName + '/record-start', function (req, res) {
  call_control_record_start(g_telnyx_api_auth_v2, req.query.participant);
  res.end("recording started for " + req.query.participant);
})
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

#### `Stop recording call leg`

*`https://<webhook_domain>:8081/telnyx-conf-v2/record-stop?participant=x`*

```javascript theme={null}
rest.get('/' + g_appName + '/record-stop', function (req, res) {
  call_control_record_stop(g_telnyx_api_auth_v2, req.query.participant);
  res.end("recording stopped for " + req.query.participant);
})
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Lightning-up the application

Finally the last piece of the puzzle is having your application listening for Telnyx Webhooks:

```javascript theme={null}
const server = rest.listen(8081, function () {
  const host = server.address().address
  const port = server.address().port
})
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

## Ruby

⏱ **60 minutes build time || <a href="https://github.com/team-telnyx/demo-conference-ruby">Github Repo</a>**

### Introduction to conferencing

The [Voice API framework](/api-reference/call-commands/dial), previously called Call Control, is a set of APIs that allow complete control of a call flow from the moment a call begins to the moment it is completed. In between, you will receive a number of [webhooks](/docs/voice/programmable-voice/receiving-webhooks) for each step of the call, allowing you to act on these events and send commands using the Telnyx Library. A subset of the operations available in the Voice API is the [ Conference](/api-reference/conference-commands/conference-recording-start) API. This allows the user (you) to create and manage a conference programmatically upon receiving an incoming call, or when initiating an outgoing call.

The <a href="https://github.com/team-telnyx/telnyx-ruby">Telnyx Ruby Library</a> is a convenient wrapper around the Telnyx REST API. It allows you to access and control call flows using an intuitive object-oriented library. This tutorial will walk you through creating a simple Sinatra server that allows you to create and manage a conference.

### Setting up your environment

Before beginning, please ensure that you have the Telnyx and Sinatra gems installed.

```bash theme={null}
gem install telnyx sinatra
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Alternatively, create a Gemfile for your project

```ruby theme={null}
source 'https://rubygems.org'

gem 'sinatra'
gem 'telnyx'
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

This tutorial assumes you've already [set up your developer account and environment](/development) and you know how to [send commands](/docs/voice/programmable-voice/sending-commands) and [receive webhooks](/docs/voice/programmable-voice/receiving-webhooks) using the Telnyx Voice API.

The <a href="https://portal.telnyx.com/#/app/call-control/applications">Voice API Application</a> needs to be setup to work with the conference control api:

* make sure the *Webhook API Version* is **API v2**
* Fill in the *Webhook URL* with the address the server will be running on. Alternatively, you can use a service like [Ngrok](https://ngrok.com) to temporarily forward a local port to the internet to a random address and use that. We'll talk about this in more detail later.

Finally, you need to create an <a href="https://portal.telnyx.com/#/app/auth/v2">API Key</a> - make sure you save the key somewhere safe.

Now create a file such as `conference_demo_server.rb`, then write the following to setup the telnyx library.

```ruby theme={null}
require 'sinatra'
require 'telnyx'

CONFIG = {
    # The following 3 keys need to be filled out
    telnyx_api_key: 'YOUR_API_KEY',
    phone_number: 'TELNYX_PHONE_NUMBER', # the number that will be used for accessing the conference
    connection_id: 'CONNECTION_ID', # the connection id for phone number above
}

# Setup telnyx api key.
Telnyx.api_key = CONFIG[:telnyx_api_key]
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Receiving webhooks & creating a conference

Now that you have setup your auth token, phone number, and connection, you can begin to use the API Library to make and control conferences. First, you will need to setup a Sinatra endpoint to receive webhooks for call and conference events. There are a number of webhooks that you should anticipate receiving during the lifecycle of each call and conference. This will allow you to take action in response to any number of events triggered during a call. In this example, you will use the `call.initiated` and `call.answered` events to add call to a conference. Because you will need to wait until there is a running call before you can create a conference, plan to use call events to create the conference after a call is initiated.

```ruby theme={null}
# ...
# Declare script level variables
calls = []
conference = nil 

set :port, 9090
post "/webhook" do
  # Parse the request body.
  request.body.rewind
  data = JSON.parse(request.body.read)['data']

  # Handle events
  if data['record_type'] == 'event'
    case data['event_type']
    when 'call.initiated'
      # Create a new call object.
      call = Telnyx::Call.new id: data['payload']['call_control_id'],
                              call_leg_id: data['payload']['call_leg_id']
      # Save the new call object into our call list for later use.
      calls << call
      # Answer the call, this will cause the api to send another webhook event
      # of the type call.answered, which we will handle below.
      call.answer

    when 'call.answered'
      # Find the stored call, which was created during a call.initiated event.
      call = calls.find { |call| call.id == data['payload']['call_control_id'] }

      # Create a new conference if this is the first caller and there
      # is no conference running yet.
      if conference.nil?
        conference = Telnyx::Conferences.create call_control_id: call.id,
                                                name: 'demo-conference'

      # If there is a conference, then add the new caller.
      else
        conference.join call_control_id: call.id
      end
    when 'call.hangup'
      # Remove the ended call from the active call list
      calls.reject! {|call| call.call_leg_id == data['payload']['call_leg_id']}
    end
  end
end
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Pat yourself on the back - that's a lot of code to go through! Now let's break it down even further and explain what it does. First, create an array for keeping track of the ongoing calls and define a variable for storing the conference object. Then, tell Sinatra to listen on port 9090 and create an endpoint at `/webhook`, which can be anything you choose as the API doesn't care; here we just call it webhook.

```ruby theme={null}
calls = []
conference = nil 

set :port, 9090
post "/webhook" do
# ...
end
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Next, parse the data from the API server, check to see if it is a webhook event, and act on it if it is. Then, you will define what actions to take on different types of events.

```ruby theme={null}
post "/webhook" do
  request.body.rewind
  data = JSON.parse(request.body.read)['data']
  if data['record_type'] == 'event'
    case data['event_type']
    # ...
  end
end
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Here is where you will respond to a new call being initiated, which can be from either an inbound or outbound call. Create a new `Telnyx::Call` object and store it in the active call list, then call `call.answer` to answer it if it's an inbound call.

```ruby theme={null}
when 'call.initiated'
  call = Telnyx::Call.new id: data['payload']['call_control_id'],
                          call_leg_id: data['payload']['call_leg_id']
  calls << call
  call.answer
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

On the `call.answered` event, retrieve the stored call created during the `call.initiated` event. Then, either create a new conference if this is the first call and there isn't a conference running yet, or add the call to an existing conference. Note that a `call_control_id` is required to start a conference, so there must aready be an existing call before you can create a conference, which is why we create the conference here.

```ruby theme={null}
when 'call.answered'
  call = calls.find { |call| call.id == data['payload']['call_control_id'] }

  if conference.nil?
    conference = Telnyx::Conferences.create call_control_id: call.id,
                                            name: 'demo-conference'
  else
    conference.join call_control_id: call.id
  end
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

And finally, when a call ends we remove it from the active call list.

```ruby theme={null}
when 'call.hangup'
  puts 'Call hung up'
  calls.reject! {|call| call.call_leg_id == data['payload']['call_leg_id']}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### Authentication for your conferencing application

Now you have a working conference application! How secure is it though? Could a 3rd party simply craft fake webhooks to manipulate the call flow logic of your application? Telnyx has you covered with a powerful signature verification system! Simply make the following changes:

```ruby theme={null}
# ...
ENV['TELNYX_PUBLIC_KEY'] = 'YOUR_PUBLIC_KEY' # Please fetch the public key from: https://portal.telnyx.com/#/app/account/public-key
post '/webhook' do
  request.body.rewind
  body = request.body.read # Save the body for verification later
  data = JSON.parse(body)['data']

  Telnyx::Webhook::Signature.verify(body,
                                    request.env['HTTP_TELNYX_SIGNATURE_ED25519'],
                                    request.env['HTTP_TELNYX_TIMESTAMP'])
# ...
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

Fill in the public key from the Telnyx Portal <a href="https://portal.telnyx.com/#/app/account/public-key">here</a>. `Telnyx::Webhook::Signature.verify` will do the work of verifying the authenticity of the message, and raise `SignatureVerificationError` if the signature does not match the payload.

### Conferencing usage

If you used a Gemfile, start the conference server with `bundle exec ruby conference_demo_server.rb`, if you are using globally installed gems use `ruby conference_demo_server.rb`.

When you are able to run the server locally, the final step involves making your application accessible from the internet. So far, we've set up a local web server. This is typically not accessible from the public internet, making testing inbound requests to web applications difficult.

The best workaround is a tunneling service. They come with client software that runs on your computer and opens an outgoing permanent connection to a publicly available server in a data center. Then, they assign a public URL (typically on a random or custom subdomain) on that server to your account. The public server acts as a proxy that accepts incoming connections to your URL, forwards (tunnels) them through the already established connection and sends them to the local web server as if they originated from the same machine. The most popular tunneling tool is `ngrok`. Check out the [ngrok setup](/development/development-tools/ngrok-setup/index#ngrok) walkthrough to set it up on your computer and start receiving webhooks from inbound messages to your newly created application.

Once you've set up `ngrok` or another tunneling service you can add the public proxy URL to your Connection in the Mission Control Portal. To do this, click  the edit symbol \[✎] next to your Connection. In the "Webhook URL" field, paste the forwarding address from ngrok into the Webhook URL field. Add `/webhooks` to the end of the URL to direct the request to the webhook endpoint in your Sinatra server.

For now you'll leave “Failover URL” blank, but if you'd like to have Telnyx resend the webhook in the case where sending to the Webhook URL fails, you can specify an alternate address in this field.

### Complete running Voice API conference application

The <a href="https://github.com/team-telnyx/demo-conference-ruby/tree/master/api-v2">api-v2 directory</a>
contains an extended version of the tutorial code above, with the added ability to control the conference from the console! See the comments in the code for details on invoking the commands.
