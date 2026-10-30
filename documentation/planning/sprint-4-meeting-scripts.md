Sprint 4 planning (about 30 minutes)

Opening

Hi everyone, thanks for joining.
I will run sprint planning for Sprint 4 today, basically what we are building for the showcase and who is taking what.
So we will go through four things, which are what we finished in Sprint 3, the goal of Sprint 4, estimating and cutting the backlog, and then who owns what.

Sprint 3 review

So first, Sprint 3 is closed and every ticket in it is Done.
We finished 56 points in total. Seann did 27 points across the venue booking stories, which are L1, L2, L4, L5, M1, M2, N1, N2 and I2. I did 15 points, which are Q1, Q2, S1, S2 and L6. Yichen did L3 and K2, which is 6 points, and also EN-11, the Temporal workflows. Shawmya did F5, which is 5 points, and Sahanya did H3, which is 3 points.
So 56 points is what we can do in a full two-week sprint, and we will use that to size Sprint 4.

Sprint 4 goal and timing

Now we talk about Sprint 4.
The goal on Jira is Registration, readiness and change impact, for the showcase.
The dates are 21 October to 3 November, but the sprint has not been started in Jira yet. So we have about one week left, not two, which means we can take roughly half of what we did last sprint, so about [confirm: 25 to 30] points.
It is important to note that the sprint has 35 tickets in it right now, and only one of them has an estimate, which is F3 at 3 points. Nothing is assigned yet. So most of today is estimating and cutting.

What is in the backlog

So the 35 tickets fall into five groups.
First, registration, which is R1 to R7, like browsing events, registering, withdrawing and the waitlist. These need EN-13, which is the registration service and seat inventory.
Second, cancellation and readiness, which is F3 to cancel an event, F4 to release its arrangements, and U1 for the Operational Safety Check.
Third, change impact, which is G2 and S3, and these build on the change requests from S1 and S2.
Fourth, venue blocks and assignments, which is I3 to I6 for venue unavailability and A4, E3, E4 and E5 for coordinator assignment.
Finally, there are 13 engineering tasks, EN-10 and EN-12 to EN-23, like containers, the API gateway and load tests, and two customer questions, CQ-11 and CQ-12.

Proposal: what to cut

So my proposal is that we keep the user stories for the showcase and move most of the engineering tasks out.
For the engineering tasks, I suggest we keep EN-13 since registration needs it, and move the other twelve to Sprint 5. [confirm: whether EN-10 deployment is needed for the showcase]
For the customer questions, CQ-11 and CQ-12 are not code, so whoever talks to the customer this week takes them, and the stories that depend on them wait for the answer.
Then we estimate what is left with planning poker, starting from registration since it is the biggest group.

Proposal: who owns what

Then for owners, I have a proposal based on what each of us built last sprint, so the work follows the code we already know.
For change impact and release, I will take G2, S3 and F4, since F4 reuses the release functions from Q2 and L6.
For Shawmya, F3 and U1, since they follow from F5's readiness check.
For Seann, I3 to I6, since they extend I2 and N1.
For Yichen, EN-13 and the seat side of registration, which is R2 and R6, since they need the seat inventory.
For Sahanya, R1, R3 and R4, which are the attendee screens for browsing, viewing and withdrawing.
For Joash, R5, R7 and the assignment stories A4 and E3 to E5. [confirm: Joash's availability, since Joash had no tickets in Sprint 3]
This is only a starting point, so please say if you want to swap.

Closing

So to wrap up, after this I will update Jira with the estimates, the owners and the cut tickets, and then start the sprint.
Stand-up is [confirm: time] every day until the showcase on 3 November.
Any questions before we end?


Daily stand-up (about 10 minutes)

Opening

Hi everyone, let us start stand-up.
We will go round once, and for each person it is three things, which are what you finished since last stand-up, what you are doing today, and anything blocking you.
Please keep it to about one minute each, and anything longer we take after stand-up.
We have [confirm: number] days left until the showcase on 3 November.

Raphael

So I will start.
Since last stand-up, I [fill in: progress on G2, S3 or F4, with the PR number].
Today I am [fill in].
For blockers, [fill in, or say no blockers].

Seann

Then Seann, for the venue block stories, which are I3 to I6.

Shawmya

Then Shawmya, for F3 and U1.

Yichen

Then Yichen, for EN-13 and the registration seat stories, R2 and R6.

Sahanya

Then Sahanya, for the attendee screens, which are R1, R3 and R4.

Joash

Then Joash, for R5, R7 and the assignment stories.

Shared items

So before we end, a few things for everyone.
For pull requests, every PR needs one approval before it merges, so please check if anyone is waiting on your review.
For the shared database, migrations are run after a PR merges, so please say if your story adds one.
And for the customer questions, CQ-11 and CQ-12, [fill in: whether the customer has answered].

Closing

So that is everyone. Anything blocked, let us stay on after this and sort it out.
Same time tomorrow.


Cut: Per-story estimates and the reasons behind each owner pairing beyond one line, since Jira has no estimates yet and the owners are only a proposal. The stand-up turns for others are prompts only, since nothing in Sprint 4 has started.

Confirm: The 25 to 30 point target for one week, which is half of Sprint 3's 56 points over two weeks. Whether EN-10 is needed for the showcase. Joash's availability, since Joash appears in Jira but had no Sprint 3 tickets. The stand-up time and the number of days left. Everyone's names as they want them said, since Jira shows usernames like yichen.chai.2024 and K SHAWMYA.

Be ready: Someone may ask why the sprint shows 21 October to 3 November if it has not started. The answer is that the dates were set at Sprint 3 planning but the sprint was never started in Jira, so we lost about a week and the scope has to shrink. Someone may also push back on moving the engineering tasks out. The answer is that the showcase is judged on user-facing stories, and EN-13 stays because registration cannot work without it.
