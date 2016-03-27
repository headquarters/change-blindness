# Change Blindness Study Website

This is the code for the change blindness study website used for my Master's thesis at UNC Chapel Hill.
It is a Ruby/Sinatra app.

## Requirements
- Ruby (Sinatra, Postgres, SQLite, & Datamapper gems)
- SQLite (for development locally)
- Postgres (for production)
- Rerun (optional for local development)

## Setup
Install dependencies using [Bundler](http://bundler.io/) via `bundle install`. A SQLite database file is used locally in development mode. A Postgres database is used in production mode. This code was intended to be deployed to an OpenShift environment, similar to [UNC's CloudApps platform](http://cloudapps.unc.edu/).

## The application
The entire application is in `app.rb`. Once all the dependencies are installed, the application can be run by using the shell script in the root of the project if you have `rerun` installed (`./run.sh`) or just running `ruby app.rb`. 

## The study
There were 3 conditions being applied throughout a session: a 0.5-second delay between elements changing on screen ("blank-screen"), a normal HTTP request to a new page ("normal-http"), and an instant client-side only change ("no-http"). The conditions are in an array in `app.rb` that is used to ensure they are all equally applied--they're popped off the array one at a time at random. 

#### Sample application

As of 2016-27-03, the [original study website](http://cbstudy-mhead.apps.unc.edu/) is *still* up and running somehow (I graduated in May 2015). 
