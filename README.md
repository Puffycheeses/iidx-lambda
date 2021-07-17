# IIDX-Lambda
IIDX Lambda is a Typescript Serverless based project that attempts to emulate the EAmuse service used by IIDX 27: Heroic Verse

## Goals
The goal of this project is not to replace any existing tools that emulate EAmuse services.
However this project should work as a standalone server if needed be.

This project will attempt to be a 0 cost program when running on AWS. This will be accomplished by taking advantage of the free tiers provided by AWS Lambda and AWS DynamoDB

The project wil be written in Typescript and follow strict typing, making it as easy as possible to fork this repo or learn about how the EAmuse service functions

## Contributing
If tackling an open issue please:
- Work on the related branch `issue-<issueNumber>-<issueName>`
- Include `[issue-<issueNumber>]` in the commit message

If adding an endpoint please follow a similar structure to other endpoints in the project

## Attribution
This project would not be possible without [BemaniUtils](https://github.com/DragonMinded/bemaniutils) which a majority of this codebase will be based around.  
We _**Highly**_ encourage backporting any major advancements in this project to that repo.
