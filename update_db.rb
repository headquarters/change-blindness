require "rubygems"
require "bundler/setup"
require "data_mapper"

DataMapper::Logger.new($stdout, :debug)
DataMapper.setup(:default, 'sqlite:cb.db')

require './models'

# !!!CLEARS ALL DATA!!!
DataMapper.auto_migrate!