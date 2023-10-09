import tensorflow as tf
from keras.models import load_model
from keras.preprocessing import image
import matplotlib.pyplot as plt
import numpy as np
import os
from pymongo import MongoClient
from PIL import Image
import io

# Connect to MongoDB
# client = MongoClient('mongodb://localhost:3000/')
client = MongoClient('mongodb://localhost:27017/')
db = client['imagesInMongoApp']
collection = db['images']
model = load_model("model.h5")
latest_image = collection.find_one(sort=[('_id', -1)])
image_data = latest_image['img']['data']
img = Image.open(io.BytesIO(image_data))

if latest_image is None:
    print('No image documents found in the collection.')
else:
    try:        
        img = img.resize((224,224))
        #img = tf.keras.utils.load_img(img_path,target_size=(150,150))
        img_tensor = tf.keras.utils.img_to_array(img)                   # (height, width, channels)
        img_tensor = np.expand_dims(img_tensor, axis=0)         # (1, height, width, channels), add a dimension because the model expects this shape: (batch_size, height, width, channels)
        img_tensor /= 255.                                      # imshow expects values in the range [0, 1]

        # return img_tensor



    

        pred = model.predict(img_tensor)
        result = pred[0][0]*100 
        if result:
            print(result)
        else:
            print("Congratulation You Are Safe")
    except Exception as e:
        print('Error occurred:', str(e))
