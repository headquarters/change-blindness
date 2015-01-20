require 'rubygems'
require 'data_mapper'

DataMapper::Logger.new($stdout, :debug)
DataMapper.setup(:default, 'sqlite:cb.db')

require './models'

DataMapper.auto_migrate!

#Trial.create(:page_name => "Home Page", :changed_area => "Upper Left")

#DataMapper.finalize!