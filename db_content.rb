require 'rubygems'
require 'data_mapper'

DataMapper::Logger.new($stdout, :debug)
DataMapper.setup(:default, 'sqlite:cb.db')

require './models'

DataMapper.auto_migrate!

#health_history_category = Category.create(:category_name => "Health History", :category_identifier => "health-history")

DataMapper.finalize!