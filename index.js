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
    strict: false,
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

    // get all services and my services
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

    //get one service details
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await Services.findOne(query);
      res.send(result);
    });

    //post service
    app.post("/services", async (req, res) => {
      const newService = req.body;
      const result = await Services.insertOne(newService);
      res.send(result);
    });

    // update my service
    app.patch("/myservices/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const filter = { _id: new ObjectId(id) };
      delete updatedData._id;
      const update = {
        $set: updatedData,
      };

      console.log("ID:", id); // Log the service ID
      console.log("Updated Data:", updatedData); // Log the incoming data

      const result = await Services.updateOne(filter, update);
      res.send(result);

      //   if (result.modifiedCount > 0) {
      //     res.send({
      //       message: "Service updated successfully",
      //       modifiedCount: result.modifiedCount,
      //     });
      //   } else {
      //     res
      //       .status(404)
      //       .send({ message: "No service found with the given ID" });
      //   }
      // } catch (error) {
      //   res.status(500).send({ message: "Failed to update service", error });
      // }
    });

    //post review
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

    // get all services review
    app.get("/allreviews", async (req, res) => {
      try {
        const reviews = await Services.aggregate([
          // Unwind the reviews array, keeping services with empty reviews
          { $unwind: { path: "$reviews", preserveNullAndEmptyArrays: true } },
          // Project necessary fields for the response
          {
            $project: {
              companyName: 1,
              serviceTitle: 1,
              category: 1,
              "reviews.userEmail": 1,
              "reviews.userName": 1,
              "reviews.userProfile": 1,
              "reviews.review": 1,
              "reviews.rating": 1,
              "reviews.addedDate": 1,
            },
          },
        ]).toArray();

        res.status(200).send(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).send({ message: "Failed to fetch reviews", error });
      }
    });

    //get my review
    app.get("/reviews", async (req, res) => {
      const userEmail = req.query.userEmail;

      if (!userEmail) {
        return res
          .status(400)
          .send({ message: "userEmail query parameter is required" });
      }

      try {
        const result = await Services.aggregate([
          { $unwind: "$reviews" }, // Flatten the reviews array
          { $match: { "reviews.userEmail": userEmail } }, // Match reviews by userEmail
          {
            $project: {
              _id: 1, // Exclude the service ID from the result
              companyName: 1,
              serviceTitle: 1,
              category: 1,
              reviews: 1, // Include only the matched review
            },
          },
        ]).toArray();

        if (result.length === 0) {
          return res
            .status(404)
            .send({ message: "No reviews found for the specified userEmail" });
        }

        res.send(result);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).send({ message: "Internal Server Error", error });
      }
    });

    // review updates
    app.patch("/services/:serviceId/reviews", async (req, res) => {
      const { serviceId } = req.params;
      const { userEmail, review, rating, updatedDate } = req.body;

      // try {
      const filter = {
        _id: new ObjectId(serviceId),
        "reviews.userEmail": userEmail, // Ensure the review belongs to the current user
      };

      const update = {
        $set: {
          "reviews.$.review": review,
          "reviews.$.rating": rating,
          "reviews.$.updatedDate": updatedDate,
        },
      };

      const result = await Services.updateOne(filter, update);
      res.send(result);

      //   if (result.modifiedCount > 0) {
      //     // Fetch the updated service to confirm the update
      //     const updatedService = await Services.findOne({
      //       _id: new ObjectId(serviceId),
      //     });
      //     const updatedReview = updatedService.reviews.find(
      //       (rev) => rev.userEmail === userEmail
      //     );

      // res.send({
      //   message: "Review updated successfully",
      //   updatedReview,
      // });
      //   } else {
      //     res.status(404).send({
      //       message: "Review not found or user not authorized to update",
      //     });
      //   }
      // } catch (error) {
      //   res.status(500).send({ message: "Failed to update review", error });
      // }
    });

    //review delete
    app.delete("/services/:id/reviews", async (req, res) => {
      const serviceId = req.params.id;
      const { userEmail } = req.query; // Get userEmail from query parameters

      // try {
      const filter = { _id: new ObjectId(serviceId) };
      const update = {
        $pull: { reviews: { userEmail: userEmail } },
      };

      const result = await Services.updateOne(filter, update);

      //   if (result.modifiedCount > 0) {
      //     res.send({ message: "Review deleted successfully" });
      //   } else {
      //     res.status(404).send({ message: "No review found for the given email" });
      //   }
      // } catch (error) {
      //   res.status(500).send({ message: "Failed to delete review", error });
      // }
    });

    // delete my service
    app.delete("/services/:id", async (req, res) => {
      const serviceId = req.params.id;

      // try {
      const filter = { _id: new ObjectId(serviceId) };

      const result = await Services.deleteOne(filter);

      //   if (result.modifiedCount > 0) {
      //     res.send({ message: "Review deleted successfully" });
      //   } else {
      //     res.status(404).send({ message: "No review found for the given email" });
      //   }
      // } catch (error) {
      //   res.status(500).send({ message: "Failed to delete review", error });
      // }
    });

    // filter by service title
    app.get("/search", async (req, res) => {
      const { serviceTitle, category } = req.query;
      const filter = {};
      if (serviceTitle) {
        filter.serviceTitle = { $regex: serviceTitle, $options: "i" };
      }
      if (category) {
        filter.category = category;
      }
      const services = await Services.find(filter).toArray();
      res.send(services);
    });

    // filter by category
    app.get("/categories", async (req, res) => {
      const categories = await Services.distinct("category");
      res.send(["All", ...categories]);
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
