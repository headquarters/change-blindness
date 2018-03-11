source 'https://rubygems.org'
# If deploying to an OpenShift environment
# source "http://mirror.ops.rhcloud.com/mirror/ruby/"

gem 'rack', '1.5.2'

group :development do
	gem 'dm-sqlite-adapter'
end

group :production do
	gem 'pg'
	gem 'dm-postgres-adapter'
end

gem 'data_mapper'
gem 'sinatra'
