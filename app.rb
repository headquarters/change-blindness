require 'rubygems'
require 'sinatra'
require 'data_mapper'
require 'json'

# Require the session file that contains the session secret and expiry time
require './session'

set :bind, '0.0.0.0'
=begin
configure :development do
  DataMapper::Logger.new($stdout, :debug)
end

DataMapper.setup(:default, 'sqlite:cb.db')

require './models'

DataMapper.auto_upgrade! 
DataMapper.finalize
=end
# Part of the <title> that will not change, gets appended to other strings in views
ORGANIZATION = "Brick Mart"
# Full <title> passed to a view by being global
@@page_title = "Page Title"

# Height and weight count as 1 question (BMI).
#TOTAL_QUESTIONS = 17

# Use round() when displaying.
#INCREMENT = 100.0/TOTAL_QUESTIONS


before do
  # Get the first session with this session_id or just create it and return that session row
  #@session = Session.first_or_create(:session_id => session.id)
end

# Home page
get '/' do
  @@page_title = "Home | " + ORGANIZATION
  @active = "home"
  erb :home  
end

# Category page
get '/category' do
  @@page_title = "Categories | " + ORGANIZATION
  @active = "categories"
  erb :category  
end

# Product page
get '/product' do
  @@page_title = "Lego Brick 39479 | " + ORGANIZATION
  @active = "product"
  erb :product
end



helpers do
  def prevent_widows(text)
    if text.kind_of? String
      trimmed_text = text.rstrip
      last_space_index = trimmed_text.rindex(" ")
      
      if !last_space_index.nil?
        text[last_space_index] = "&nbsp;"
      end
    end

    return text
  end
end