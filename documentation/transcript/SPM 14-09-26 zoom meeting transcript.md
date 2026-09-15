14-09-26 zoom meeting transcript.md


Okay, I'll wait, so, uh, I'm looking at your version too.

Yeah.

So, are you actually gonna use for BMQ for, like, or message broker?

Or BMQ is not that good.

Oh, we can do and use rapid MQ, we just, I don't know.

If you want, you can find something else.

Let me do, like, a system, but, um, website, like, uh, tunnel.

Tunnel.

Then, like, you don't, then the tunnel is persistent so that we can, we don't have to. Yeah.

You know what I'm saying?

Can know, but.

Wait, so the tunnel.

The tunnel is just to handle a cure, right?

But we still need.

You what?

But why do you need a queue?

Why do you need it to be asynchronous?

Can't it be like, just post, uh, post and get.

Invoke.

Yeah, yeah.

Invocation based.

What's the, uh, I just want to know, like, what's the additional benefit of making it, uh, message base?

I mean, If it's in vocation-based, for example.

For example, if like, um, um, I own a certain equipment, right?

Now I'm renting an equipment and whatnot, right?

Then once I rent out already, then I should get a notification that I successfully that the equipment slot has been rented to me already.

So the notification will be idiot ma, no?

Yeah, the notification will be in general.

So I don't need to go through the, the defend bus.

I mean, we don't need an event bus, but the event bus is, it was just there because, I think it got mixed up with something else.

Okay.

Okay.

Um Uh-huh, no, no, no.

No, no, no, that looks so cool.

Yeah, then for the identity one, right?

We technically student identity service one.

Because, uh, we also need to store their rules, like their, their rules, can't superbase off, handle that.

Yeah, but in Superbase off, there's no, there's no column for you to store rolls in their superbase off, I think.

Okay.

Uh, what do you want to use as a game?

Use con, use con now, okay, can.

Yeah, yeah.

Event service owns even advocate status.

Okay, registration.

Okay.

So for the for the login, who's doing it, are you the one doing it?

Yeah, I'm doing it.

Okay.

Then, for the login, do you just want, uh, user, password or?

Are you on like Google, Google, sign YouTube?

Uh, uh, it doesn't matter.

It's up to us, right?

So, yeah.

I just used the fireways, the fireways have his own method.

I mean, if I mean, Superbase has his own math, like Google, O of sign in, then I'll just use that.

I don't have to create data.

But there, there, there's Google, like, there's the Google signing option.

It's just that it's disabled.

Can you see if you can enable your end or do I have to give you permission?

Da, da, da, da, da, da, da, I don't see Google.

I see Apple as your Facebook.

It's all already.

I see it.

Yeah.

What a client ID.

Uh, divine, don't know.

Wait, let me search.

Oh, that one you need to get from the.

You didn't get the ID from Google, Google Club, Google Club platform.

But I think for the time being, we just use email and email password 1st up.

Okay, can.

Yeah.

Cause I think.

Uh, in the clarification that they, I think he, I think there was clarification that attendees need to create an account also, yeah.

But yeah, the the clarification, uh, They stated.

They stated the system needs to handle like 500, 500 stuff, like internal stuff.

Yeah, I thought I read the thing already.

Okay.

So, How should we, how should we get started?

Like, I, I, I, I, I, I'm fine to follow this thing, but then it's, I don't want to be, like, garbage shop.

Yeah.

Like, I have no clue, one of this thing, honestly.

Like are there redundant structures, are there structures that we're not even thinking of?

Dude, I wish Raphael was here.

Rafael.

Wait, so George is not, like, he's not coming to school for this entire week.

Yeah.

I think so.

Damn.

But was he in class, did?

No, he wasn't.

I mean, he might come in there, but today he definitely won't be, because he's, uh, because his girlfriend fly, fly for overseas, like blendidly.

Oh, yeah.

Bro, it is in the transcript now. Remove it.

Where is Rafael, yeah?

Do you want to, do you want to stop recording first?

Then on the date.

Okay, okay, okay, okay, okay.

Yeah, he started recording this.

Okay, wait.

I just continue saying first.

So for the API gateway, I think we're gonna use Kong to route everything and manage, right?

And then, uh, they basically we got like a bunch of worker services.

But it's, but it's not really important.

What's important is that we, we, we have like a placeholder for like a message broker or event bus, which is supposed to, like, for example, registration service is publishing certain events over here, and then this will deliver to somewhere else, like deliver event change and cancellation to equipment service.

So this is like uh, uh, composite.

It's not a composite.

It's just a messaging between multiple independent services that we want to implement.

So, I was thinking that, like, we don't need, we can use messaging, like, cause it's asynchronous, but then we can also persist like a web socket, so that, but, socket tunnel, so that the, when we need the, the services will talk to each other simultaneously, more than one services talking to each other, then we can have their website, okay?

So, this is general place over, but we need to decide on what this should be.

Alternatively, we can just do direct, um, HDB postal.

Yeah.

Okay, that is Siri.

Yeah, this is like, uh, we, we, I don't know, use, like, rate limiting plug-ins, JWT.

Wait, how do you make all these, you, you call it there?

Yeah, we, uh, Sean called it this.

Holy shit.

Okay.

Yeah, I just throw in the project specs and the, the user stories that like the finalised one that we agree on, then I ask it the generator, yeah.

Okay.

But I just need your opinion, like, what do you think we should be doing?

Well, I mean, I, uh, we can just do what they tell us to do for now.

But then we just like, not even thinking, you know, it's like they just give us them like, oh.

No, honestly, it looks right, what, this like totally the same as ESD, like totally the same.

Yeah, it looks the same, but like, then the halfway we implement, then got some fuck shit.

Then we then we need to go back to the drawing board.

I don't want that to happen.

But let me think.

So, like, what, what, what is the?

No, the issue.

What is the thing we need to, what, what do we need to like prioritise it?

Like, you know, like, you know, the capturem?

The what?

Cap theorem, like consistency, availability, partition, tolerance.

Like, okay, like.

No, there's just such capturem.

CAP.

Uh...

Yeah, we just need kept the aroma, basically.

Yeah, we cannot choose tree, you know, we only can choose 2 of this tree.

So that's what the capital says.

The cap theorem says that you only can choose to.

And there's the truth, uh, consistency, like no, what's important for our thing?

Okay, so basically in the, the clarification that they, uh, The, the customer says the website needs to handle like 500, 500 customers, 500 users.

Yeah.

Why is this?

Why can he choose 2 only?

Why is the trade-off?

Don't get it.

So there is a trade-off.

Uh-huh. Explain.

No, you read it, man.

Like, it's not, it is like very important, by the way.

Oh okay, I'm learning new shit.

Okay, so.

Let's think about it.

Okay, so it's an event booking system.

What's very, what's the most important thing about event booking system?

Is it that they can see things all the time or is it that?

It is right all the time.

You know what I mean?

This this.

It should be on time instead of right all the time, I think.

So, what, what?

Really, are you sure?

Well, I think it should be partition. Right, right, right, right.

Do you like shading?

Okay, so basically, It's, it's always like, it's always, um, I think you always choose partition tolerance, then like you are just choosing whether resistance your availability.

Yeah.

Yeah, that's what I'm saying.

I think we can go with consistency, because, like, based on what, uh, I also think so.

Okay, like, if you think so, then can just say so.

Of course I don't know anything.

No, no, no.

No, yeah, no, basically I'm saying that it has to be right more than it has to be online.

Okay, okay, okay.

So how does this implicate what we are saying right now?

No, so it affects like the database we use.

Like, that's the biggest implication, then, like, um, let me think if it's, if it's a message book, I guess it works, lah.

I think it's, um, I think basically use SQ.

CPW is crazy, man.

Okay.

Okay.

Yeah, I think super base is is good.

See, because says here, I think, I think.

When, when you created the, When you refine the user stories from the user stories that I created, you, destroying the clarification.

Wait, okay no.

Did the, did the, customer talk about like, oh, how much it has to be online?

What's up, time, like 99.9%, 99.9%?

Did they say?

Nobody asked that.

So I, so that one, nobody...

Hmm.

Okay.

Yeah, I just said the new version of the diagram.

Okay.

Oh, so every time you need to send new one, it's not like some Google Docs, like if I change then you can see, is it?

Uh, because this one is the, yeah, it's the DSL file, technically can edit it, but I, I mean, I never used this before, so I, not really sure how to, like, manually I did it.

Oh, this is like the same thing as acid, right?

Like consistency and.

Yes, yes, yes.

Yeah, that's that's why, that's why I say, okay.

Firstly, it affects the database we use.

But it also affects like whether we use like message broker and like HTTP and whatever because um, Like one is like more durable than the other, you know.

So can we uh?

Like say that our.

Our server goes down.

Then, if there is a, say there is a transaction being processed halfway, then afterwards, then we will just do another right operation, we will have like a state tracker.

So the state tracker will do a right operation to, no, I think, to update both ends.

Or all ends that require that transaction.

Okay, I think this one you don't, you don't think about it yourself because someone already has, like someone has already made the pattern for this already.

Okay.

So what the, what is the solution?

I think, right?

Yeah.

Okay.

It is, I think we use a message worker, then like, like there is some sort of item, item potency that needs to be used, there is some sort of, like, acid that has to be used, because, um, you, when you send, uh, a message, right?

Then the network goes down or something, right?

You don't know whether the message has been processed, you know.

Wait, let me.

So, which message broker do you do?

Let me, let me send you the website I've been using, bro.

Okay.

Okay, go to 3.3 I guess like if you don't want to read the whole thing because it legit takes forever.

Okay.

Yeah.

You tell, there's something, I think, on DW.

And then 3.4 also, like, um, Also, it's not bad.

Like, you make, like, design decisions, you know?

Yeah.

So keep Mongo DB.

Okay, let me see if.

You knew real shit.

Okay, we definitely don't need a thing about CDN, right?

With that, like we only have.

But it's a Singapore thing is it?

Okay, it's the whole operation in Singapore.

Uh, the whole operation in Singapore, all they uses Singapore, I mean, all the events are in Singapore, don't watch shit, yeah.

The East la, right?

Should be la.

I don't know.

Yeah.

I mean, there was no clarification there, so.

For now, we just assume that everything is in Singapore.

Yeah.

2.7 is also uh, maybe you need to read that.

What's she perform?

What's she perform?

What is he talking about?

Do you send each other?

Yeah, I did him.

I did send him, okay.

You trying to send you right?

Yeah, yeah.

Okay, wait, but what's your, what's your, what's your point with all this?

No, I'm I'm saying like you knew read, then like you knew, like think about it, man.

Okay, wait.

Okay, just, like, trust the AI. 10 minutes, by the way.

Okay.

I, I mean, I, I stopped recording, then we go to the next one.

Okay. 

Sean: Hello?

Rafael: Yeah.

Yixin: Yo, Rafael. This guy, what the hell?

Sean: Oh, he's in, he's in. Oh, yo, Rafael, can you hear us?

Rafael: Yep.

Yixin: Yo, wait, so, uh, You know, you know the, you know, the transactional outbox thing, right?

Rafael: I don't know what's that actually. What's that about?

Yixin: Basically, you create a queue using your database. So one of the schemas will be your queue. So when you, when you want to send out something, right, you send it inside the, you write it to your database first. So even if your messaging broker goes down, you still have appointment copy in your table. Something like that.

Rafael: Appointment what?

Yixin: You just Google transactional outbox pattern for acid.

Rafael: Okay, let me Google. Yeah, so it's talking about at least once delivery, like it said in the thing, right? Like you read that part, right?

Yixin: Mm-hmm. So like, we still can use—

Rafael: So the consumers need to be idempotent, but yeah, they always need to be idempotent.

Yixin: Okay.

Rafael: I think I— oh yeah, also do we need to care about logging?

Sean: Logging?

Rafael: Yeah, like monitoring, logging.

Yixin: Dude, this is like the really tough questions that Nobody is helping us on.

Rafael: No, I think maybe we can just assume, like if we just keep assuming that yes, we need, yes, we need, then like it's not going to be bad, right?

Sean: Okay, we can have logging, we can add in logging.

Yixin: Add in logging.

Rafael: Okay, it's like, okay, I just searched like, you know, all those non-functional requirements. Then we need to have like some level of it, right? Like we need it to be secure, like we need data to be encrypted, like these sort of things. Yeah, yeah.

Sean: So I guess the logging part, we can put it in sprint 3 or sprint 4. Like the one is It's not that important because I don't think it's a requirement, but if we have time, we can do it.

Rafael: Wait, for the user portion?

Sean: Yeah.

Rafael: Like, okay, what does the user do? Like, what are all the actions a user do? Like, not user, like, you know, those normal user, like, like he's not an event manager and all those stuff. How what?

Yixin: They register for the events.

Sean: Yeah, the attendees basically.

Rafael: Yeah, the attendees.

Sean: So basically this—

Rafael: no, what's all their duty? They do like all their actions. Is it they just register also?

Sean: Yeah, they just register for the event.

Yixin: They have no write, right? And they only can read. No, I mean actually they can edit their own profile. profile and shit and the events that they want to cancel, but that's about it.

Rafael: How do these people like give them the events?

Yixin: So first off, everybody needs an account, so they need to log in first, then they'll be logging in as the auth will recognize them as an external user, not external user, just like attendee, and then attendee, yeah, they have to browse through the events. So there'll be an event list. So this one I think is like a search, is more like a search function. And then afterwards, then they will just schedule. And then if there's any scheduling conflict, then it will persist an error.

Rafael: Give me a sec, I'm going to Because that sounds a bit weird actually. Hold on.

Sean: Wait, shouldn't it be like someone sends them a link or something?

Rafael: Yeah, that's what I'm thinking. Like they shouldn't be able to see the other events, right? It's not like a— because it's just like an event. planning thing. It's not like a place to— it's not like Ticketmaster where you go and look at events, you know what I mean?

Sean: Okay.

Rafael: Like this one, I think. Wait, let me see.

Sean: Wait, let me read the project instructions.

Rafael: Wait, the project instruction, is it just week 1 or there's more?

Sean: No, there's a week 4 one. Oh yeah, yeah, yeah, week 4. Yeah, we're supposed to look at the week 4 one because the week 1 one is like everything, but the week 4 one is the—

Rafael: Wait, week 4, week 4, which one you looking at? What's the 4 called?

Sean: Week 4 project instructions.

Rafael: Wait, am I in the right week or not?

Yixin: What the hell is this?

Sean: No, no, it's under the project folder in eLearn.

Rafael: Oh, it's under Scrum project.

Sean: Okay, okay. Yeah.

Rafael: Okay, event request.

Sean: Okay, blah blah blah, and you go to— okay, it doesn't state how the attendees find the event though.

Yixin: Did Brian ask this? Holy shit.

Sean: Uh, no, I don't think so. Wait, let me, let me scan through.

Rafael: Okay, wait, let me think of, let me think of something that is similar.

Sean: Oh, we can just assume that—

Rafael: I don't think you can see the other event.

Sean: We can just assume that it's a shareable link, then that link is being sent to I also think so. It's being placed somewhere, it's like being placed in some advertisement or some poster or something.

Rafael: Yeah. Okay, I also think so.

Yixin: But our ACs do not think so. Our ACs say that there should be a— I'm finding.

Rafael: Okay, because what type of events are these? Like any events?

Yixin: R1.

Sean: The AC in R1 says that there should be a browse list.

Yixin: Yeah, correct, exactly. So it's like we are already contradicting ourselves.

Rafael: But the AC is beyond 10 million, right?

Sean: Yeah, the AC is beyond 10 million.

Rafael: Yeah, I think it's wrong actually. I really think it's wrong if you think about it.

Yixin: Why?

Sean: Because they need to feed nobody.

Rafael: Let's think about, okay, let's think about who, like, okay, from a business perspective, Who will host events, right? Firstly, it's like, no, the organizer, like, who are these organizers? It's like companies, right? And then some of these, okay, some is public, some is like maybe some concert and whatever, then okay, in that case, then it doesn't matter, right? But some of it is like company events, right?

Sean: Yes.

Rafael: Um, yeah, so you don't want to go and you don't want to allow like random people to join your company event, right?

Sean: Yeah.

Rafael: Yeah. And you— and not just that, even if like we set up a password to, to put in later— oh, I know, I know already. Wait, have you heard of this thing called Joy?

Yixin: Joy?

Rafael: Wait, let me search. I was thinking of like what?

Sean: It's like a TikTok website.

Rafael: With joy, you search this TikTok with joy. Like somehow there's a lot of people that like getting married recently, then like then they send me this invite. Yeah, but basically it's like it's something like this.

Sean: Smart RSVP.

Rafael: Yeah, so okay, so a wedding is an event. You don't want to go and go to the website and look at other people's wedding, correct? Like no way, bro.

Yixin: What if I want to crash? Okay, yeah, but yeah, you're right.

Rafael: Yeah, no, but okay, you go search YouTube on this withdraw thing. I genuinely feel like the user process is very similar to this withdraw. Let me search YouTube.

Yixin: Like, yeah, no, but AI, what? Like, okay, fine. Like, even on WithJoy, I literally, I can search for events And then there's like public events as well. So there should be, you should have both link-directed and also self-directed.

Rafael: You can search, where is it?

Sean: You can search for events.

Yixin: Find an event, like you go join and then it's at the top corner, find an event, like top right corner.

Rafael: Join, join.

Sean: Oh yeah, find an event.

Rafael: Oh no, but it's not a list. Like, you can search. I think you put in a code.

Sean: You search by the name, the names.

Rafael: Okay, maybe it should be like a Kahoot thing. Like, you need to put in like some code. I don't know. You know what I mean?

Yixin: 14 events.

Sean: Oh yeah, I can see like, I can see people's website too.

Yixin: I type dinner and then I can find 14 websites.

Sean: I can find, I can see their website.

Yixin: So, so, so we should—

Rafael: It's kind of crazy. No, but I feel like this is wrong though.

Sean: Wait, I can legit RSVP.

Rafael: No, but it's not wrong.

Sean: To some couples' wedding.

Yixin: We are not business-facing. You need to know the context of why we have this event space in the first place. Because the event space is like not just wedding only or company events only.

Rafael: Yeah, yeah.

Yixin: So, so there should be publicly listed events.

Rafael: Okay, so, but okay, okay, should be both.

Yixin: Yeah, exactly what I'm saying.

Rafael: But I feel like this thing is wrong. They shouldn't be posting people's wedding out here. I don't know.

Sean: No, I can book a free hotel room.

Yixin: It's like a guideline.

Rafael: Why can't I just freaking go to other people's wedding? What is going on?

Sean: I think they forgot to set private or something. I can literally like use the promo code to book like a free accommodation.

Yixin: No, dude, they want more people to join.

Sean: There's one, but there's no Singapore events.

Rafael: No, there's definitely a lot of Singapore events, but it's just not filtered that way. Oh yeah, do we need— okay, okay, okay, okay, guys, like, we also need to think about, do we need Do we need to add filters, right? Because like if we do, right, then like SQL will be better. I mean, we are already using SQL, I think, but yeah, yeah, I mean, okay, but sure, let's just make some assumptions that, okay, there are some public events and some private events.

Sean: So for the public ones, we will have the list of Yeah, we'll have the list.

Rafael: Then for the private one, it's either a shareable link or QR code. Sure, like, you know those— okay, QR code is a link, right? No, meh?

Sean: Oh yeah, yeah, same lah.

Rafael: Like the black thing is just binary-ish, like, yeah, yeah, I know. No, then, then, uh, wait, let me think.

Sean: So the pin, the shareable link with the pin.

Rafael: No, then maybe you can have like, I don't know, like those Kahoot shit, like you put in some letters and numbers, which already comes with the link, you know, the link with the query. Yeah, yeah, maybe, maybe, you know.

Sean: Yeah, okay, I get what you mean.

Yixin: So you're thinking from like a user design perspective?

Rafael: Yes, I'm thinking from a user design perspective.

Yixin: But we just need to comply with whatever they give us. So this is like not necessary.

Rafael: No, but the thing is, I feel like they never give us enough information. So like we need to think of what is—

Sean: Okay, we can take note of this first. Okay, so this is what we currently have.

Rafael: But it's anyone, like someone's like writing this down.

Sean: It's being recorded. Yeah, then I think right now we just have to finalize the—

Yixin: I still think, no, I still think regardless of whether you're attendee, okay, no, like internal users, there should definitely be a search function.

Sean: Yeah, we will have the search function for the internal users.

Rafael: Right.

Sean: No, so each role should see a different screener.

Yixin: Yeah, but you want to limit attendees' user experience to like Carrefour Code only.

Sean: No, so on that screen we can have like an option whereby if you already know that you're just wanting to sign up for that specific event, then there's a button that says that search for event or search for event using code or something like that. Then we also have the search bar for public events.

Yixin: So we are still doing the public event? I mean, so basically it's like this Withjoy times Ticketmaster type of website.

Sean: Yeah, I think so. Unless you just want to restrict it to one, either public or private.

Rafael: Okay, but actually the reason why I asked this, right, is I want to see, like, what is the traffic pattern like? Like if it's If it's just like Ticketmaster, right, then we might want to have like a persisting server, like that's always online, you know what I mean? But if it's not, right, then like we can have, you know, those like AWS Lambda that is like serverless, and then it makes it cheaper and stuff.

Yixin: 500 people.

Rafael: Wait, do you know what I'm talking about?

Yixin: No. Let me search it up.

Rafael: You go see what server does. Okay, but I think we just don't care. We just use like, we just persist a server.

Sean: So, so it auto scales up during high traffic and then scales down to 0 when idle, is it?

Rafael: Yeah, because, okay, what I'm saying, what I'm trying to say is like, oh, like what is the traffic pattern? If it's like 90% of the time it's not being used, right, then only when those people send the link that is being used, then like It's quite waste to have the thing up like the other 90% of the time, all right?

Sean: But you still need the server for the internal stuff.

Rafael: Yeah, that one.

Yixin: Warm-up time for serverless.

Rafael: I think it's a bit, but is it very like our processing is not much?

Yixin: What? This is like really woke. Like, I don't think we can do it without server. I mean, with, yeah, with serverless.

Rafael: Okay. Yeah, yeah, that's why I said I don't think we think about it now. Okay, let's just do it.

Yixin: Do serverless.

Rafael: No, like, I think our current design quite okay.

Yixin: You haven't went through anything. Sean, you sent him the thing already? The new one?

Sean: Yeah, I sent in the group the new one. Yeah, the one 10:32.

Rafael: What the hell? Wait, why does it say I need to choose an application to open Oh, you can just open it using VS Code.

Sean: Then after that, you need to go to the website to throw it in and then to see the tag.

Yixin: No, you just download the files. Yeah. And then upload the file to Structurizer.

Sean: Yeah.

Rafael: Structurizer? Why you talking about?

Sean: I sent you the link.

Rafael: Wait, I legit cannot open the file, bro.

Sean: Wait, what?

Yixin: Oh, you're not supposed to open the file.

Sean: No, no, no, don't, don't, don't need to open the file. Just, just, just go to the website. Then you, there's an import option. Just import, import from there.

Yixin: Okay, la ba, we are using MOM, right?

Sean: MOM?

Yixin: Oh, message around the middleware.

Rafael: Yeah, yeah. Wait, but which one though? Kafka or Kafka?

Yixin: Kafka is right.

Rafael: First, he has login, right?

Yixin: No, but like we are handling logins with, um, uh, Supabase, no?

Sean: Yeah, we're handling— no, I think he's saying logging.

Rafael: Logging. Logging. Logging, logging. Wait, what? Wait, what? I thought upload the— wait, upload is the freaking file with the up arrow, right? Yeah, yeah. Wait, why is it not? What's happening? What's happening? You're literally— what's happening? Why can't you see shit?

Sean: Wait, then for the— for For one of the—

Rafael: for the—

Sean: for 2 of the user stories, they say the clarifications contradict the acceptance criteria, like I2 and S3. I mean, that one's a simple change that we just You can just change it to what the clarification says it's supposed to do. I do.

Rafael: Wait, why am I— this thing is so freaking hard to see.

Sean: Do you want to share screen?

Rafael: Wait, is it, is it, you know, the left side, right? The left side shows like, like the Donut Workspace, blah, blah, blah, right? The documentation. Can I close it? Like, that's probably like useless. I just want to see the diagram.

Sean: Uh, I don't think you can close it.

Yixin: How is I2 and S3 contradicting?

Sean: No, as in, as in they're not contradicting each other. They're contradicting the clarifications. Like the acceptance criteria for that is contradicting the clarifications. Like I sent it in the chat. You can see what contradicts.

Rafael: Oh, there's so many shit our API gateway is doing.

Sean: Okay. Yeah, I think we're routing everything through the— almost everything through the API gateway. Okay.

Rafael: Yeah.

Sean: I mean, you can take a look at this diagram and then see if you want to make any changes because This is AI generated and I don't think it's that accurate.

Rafael: I don't know, but there's so much.

Sean: Yeah, there's a lot of things.

Yixin: Wait, our sprint is like wasted already, honestly. We haven't even— because we're supposed to finish by this Friday, sprint 1.

Sean: Yeah, but like, no, but if we—

Yixin: it's so hard.

Rafael: No, like, I really don't think it— like, you, you are not supposed to like plan so much, right? You just have to just do it, bro. Wait, like, if you plan so much, it's like basically like waterfall already, bro.

Yixin: No, but like, what about test-driven development? We knew like have tests our test kits ready for like the certain stuff that we're doing.

Sean: But the test you can develop from the acceptance criteria.

Rafael: Yeah.

Yixin: We need to update our—

Rafael: You don't need like the end-to-end thing to like make the test. You don't need the end-to-end thing to make anything, man. You can just do the things you're just doing now. Then like if there's anything wrong, then you just refactor.

Yixin: So basically we just do siloed work. Each of us just do siloed work. And then after that, then we integrate.

Rafael: What do you mean by siloed work?

Sean: Wait, but the way things are split now, right? The way things are split now is like I have to wait for, I have to wait for, I don't know, like one of the girls to do finish their part.

Rafael: Which is not independent, right? We need to make it independent.

Yixin: Yeah, so independent is silo work already. So basically we are performing without like knowing all the send and get requests, the POST and GET requests, like what should be the format, expected data format. We don't have like a standardized message, overarching message-based architecture that we know that our Boilerplate is gonna communicate with.

Rafael: Yeah, I think we just need we just need to think about like what what are the messages gonna what lah?

Yixin: Yeah, exactly. So this like requires forefront planning already.

Rafael: Yeah, but no need so much in detail. I think we just know we have a message broker system currently, and we know that our our database is like.

Yixin: Okay, so if I want to engineer this with AI, I just throw Sean's work into AI and then I say, you just build, you just build certain part and then you just know that in the future that you have to accommodate for this.

Rafael: I guess even if you don't see it in the future, like you can just refactor after, it's like not a big deal.

Yixin: Okay, Sean, so which part is bottlenecking you?

Rafael: No, but I feel our thing shouldn't be so dependent. It should like be, we can just make different parts.

Sean: I mean, I can do it independently and then when they are ready, then I just integrate it. Yeah, but are they going to do the work?

Rafael: Like, honestly speaking, will you ask them?

Sean: Because if they're not going to do the work right, I'll just ask my cloud to like do everything already, man. I don't need to wait for them. They don't need to wait to integrate.

Yixin: But actually, it's really about documenting your work. Like if they see the GitHub commit, right, and they don't see Xiaomei and Sahanya's name, right, then we are GG already.

Sean: Then what about Joash?

Yixin: Ah, do I need to tell them?

Rafael: No. Yeah, just tell them, bro. Why, why can't I tell them? Yeah, okay.

Yixin: Yes, I'll tell them.

Sean: Yes, I'll tell them. Yeah, so you will tell them and tell them. Okay, so, so just to clarify, we are using Kafka for our—

Rafael: I mean, we can always use Redis.

Yixin: We're not using Lambda, right?

Rafael: Yeah, we're not. We're not.

Sean: Okay, then for our website, for our website, should we have a standardized like design guideline so that everybody's page is—

Rafael: Okay, like design is about UI. Are you talking about UI? Okay, so I think, right, There should be 2 user interfaces, one the internal and one the external, right? Correct.

Sean: Yeah. Like, okay, so as in each, each role, each role should have a different, like they should see a different thing.

Rafael: Yeah. But I think the internal one is like, even though they see different things, It's like around the same, but it's like, it's just that they have different—

Sean: The layout is a bit different.

Rafael: Maybe the layout is the same. They just have different access.

Yixin: Correct, right?

Rafael: You get what I mean? So what I do usually, right, is that the internal one, right? I just ask it to copy like the Jira Atlassian design or like GitHub design because it's professional. Then the external one is like you can do whatever, bro. You can be like damn flashy and stuff. Okay, you get what I mean, right?

Yixin: Yeah.

Rafael: Who's not buying AWS?

Yixin: Is it because we're using Kafka?

Rafael: Wait, are we actually hosting? Uh, we can just don't host, right? I mean, like, for now. Wait, you host them expensive, eh?

Yixin: I mean, like, so everything localhost.

Sean: I thought AWS got a free student credits, is it?

Rafael: Wait, you try, you try use, it's freaking extra.

Sean: Okay, okay, we just—

Rafael: Yes, my new website paid like $40, bro.

Sean: Damn.

Yixin: No, yes, it is.

Sean: Oh, does Superbase have hosting?

Yixin: Shite, bro. No, wait, AWS has $250 credit for student. Okay lah, we we just a little lah. Wah, hatay already.

Sean: Okay lah, you just code out the thing first, then we see how lah.

Yixin: So basically we are just doing like our own like individual workers first ah, our services first. Okay, can lah?

Rafael: Yeah, maybe maybe you you take whatever we say right, like all those important points like using Kafka everything, then you You go make a Claude.md push or like an agents.md push so that all our shit can read the same thing. You get what I mean?

Yixin: Yeah, yeah, no, but we don't, we don't, we don't have like a project that we're working on together because project only for teams.

Rafael: Wait, what? No, no, no. As in a Claude.md push in the GitHub.

Yixin: I get it. I get it. Okay, fine.

Rafael: Then we can pull from there. Then like we can see like we have a common like thing. Okay, then from that, like, that's basically our project already, right?

Sean: Okay, kind of.

Yixin: Sean, can you send me, can you send me a summary? You tell Claude to summarize what it did for you and you send to me, then I'll push the .md.

Rafael: No, but, but you need to read, like, a lot of things we say today, maybe we didn't say in there, like, like using Kafka and whatever.

Yixin: Yeah, yeah, the cost of the meeting transcript, it will take down reading, man.

Rafael: Okay, then also maybe Sean, you can go and redesign the tickets if needed. If you don't mind, then I do my style or something. Okay.

Sean: You can redesign the what?

Rafael: Like the tickets to make it more independent if they are not independent.

Yixin: I don't know.

Sean: I mean, it is I mean, you can just do it like it is somewhat independent.

Rafael: You can ask Todd if it's independent.

Yixin: Okay.

Rafael: Okay.

Yixin: Before, actually, we need to, we need to not just the work items, like focus on features. One, some of the work items should be the test. required for the features. So for each work item, there should be a test.

Sean: So the test—

Rafael: I see the testing is damn hard. It's like there's a lot of tests to do.

Yixin: They want to see like per sprint that we have something that is already self-contained and tested.

Rafael: Yeah, yeah. No, because like what level of test do we want to do? Like, is it just like You need test, you know what I mean? No, there's definitely like more tests. I don't know, like different level, but definitely different.

Yixin: But we're already doing something so independent, we can only test what is.

Rafael: But at the end of the sprint, we need to go through the flow, you know what I mean?

Yixin: At the end of the sprint, we're going to go through the flow. Means like we need.

Rafael: Like there should be one test to test like the whole flow of what we did in the sprint.

Sean: I don't know.

Yixin: Then we require, that requires us to have overarching microservice architecture. So then we have to integrate already. You get what I'm saying?

Sean: Wait, so should we create a microservice now?

Rafael: No, so in the cloud.md file, right, it should already say like, it should already say like, like what is the schema? Like, or you, when you send this message to a message broker, what is the message?

Yixin: Okay, yeah, but do— okay, like say, you know, each of us are creating our own services, right? Like say Atomic, right? So then now, now when we want to bring it all together, there should be a composite that handles all of our features together. Like for example, sprint 1 has features listed from A to F, for example. Then I'm doing ABC only, Sean is doing like the rest. So, but then we don't have an overarching composite that is done within this sprint to integrate both our work so that we can test it together. You know what I'm saying?

Rafael: I don't know, actually. Wait, what do you know I'm saying?

Sean: I think you're saying that— what? Okay, what I think each one is saying is that we need a— We need a composite microservice to link all the microservices together so that we can test them.

Yixin: If you want it done by Friday, like if you want it done within this and documented within a sprint, but else then we can—

Sean: Wait, so you're suggesting that we need a composite microservice?

Yixin: No, because you say—

Sean: But the problem is now we don't have—

Rafael: No, no, no, no.

Yixin: What I'm driving at is that if you want to test the full flow It means you need to do integration work already.

Rafael: Like, no, but the thing is with like the, the message broker is that like there's not a lot of integration that needs to be done, but no meh.

Yixin: Okay.

Rafael: It's like you're just picking things up here.

Yixin: I'm going to assume that everything is not asynchronous. I'm going to assume that whatever I pass out is just instantaneous post so that on Friday when we do a full flow run-through test, Then everything will just be synchronous POST, GET requests.

Rafael: Wait, does the sprint really end on Friday or is it Sunday?

Sean: Yeah, shouldn't it end on Sunday?

Yixin: It started last Sunday. Last, last Sunday.

Rafael: Yeah, so it's Sunday lah.

Yixin: I mean, yeah.

Sean: We can just change the date accordingly lah. I'm gonna just say it ends on 20th, 20th September, 2359. You guys have— but there's no 2359.

Yixin: Yeah, okay, okay, okay, we will do our own shit.

Sean: Wait, so, so Yixin, do you— you're creating the CloudMD file, right?

Yixin: Yeah, you send me or something else. In an MD.

Sean: But what do you need? What do you need the summary for?

Yixin: I need, I need basically what you task Claude to do, like everything, because I, I haven't prompted my Claude to do the system design.

Rafael: Wait, then why not Sean?

Yixin: Okay, then Sean, wait, because Sean is doing honestly— okay, Sean, then I do the Jira part, you do this part.

Sean: But what do I include in the Claude MD file?

Yixin: I send you.

Sean: I send you the system design.

Yixin: I send you the transcript of our discussion.

Rafael: Okay?

Yixin: You will know what we call another one.

Sean: Okay, okay.

Yixin: Yeah, yeah. Then that's all.

Rafael: All right.

