const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.bcwzf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const Services = client.db("InsightHub").collection("ServicesProfile");

    app.get("/services", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { ownerEmail: email };
      }
      const cursor = Services.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await Services.findOne(query);
      res.send(result);
    });

    app.post("/services", async (req, res) => {
      const newService = req.body;
      const result = await Services.insertOne(newService);
      res.send(result);
    });

    app.post("/services/:id/reviews", async (req, res) => {
      try {
        const id = req.params.id; // Extract service ID from the route
        const reviewData = req.body; // Get review data from request body

        const service = await Services.findOne({ _id: new ObjectId(id) });

        if (!service) {
          return res.status(404).send({ message: "Service not found" });
        }

        // Update the reviews array and calculate new average rating
        const updatedReviews = [...(service.reviews || []), reviewData];
        const totalReviews = updatedReviews.length;
        const averageRating =
          updatedReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

        // Prepare the updated `reviewsInfo` array
        const updatedReviewsInfo = [{ averageRating }, { totalReviews }];

        const updateResult = await Services.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              reviews: updatedReviews,
              reviewsInfo: updatedReviewsInfo, // Use array format
            },
          }
        );

        res.send({ message: "Review added successfully", updateResult });
      } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).send({ message: "Internal Server Error", error });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("complete initial server setup");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
