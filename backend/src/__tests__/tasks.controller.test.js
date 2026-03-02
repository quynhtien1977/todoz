/**
 * Unit Tests for Tasks Controller
 * Tests CRUD operations: getAllTasks, createTask, updateTask, deleteTask
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Task from "../models/Task.js";
import User from "../models/User.js";
import {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../controllers/tasksControllers.js";

let mongoServer;

// Mock request và response objects
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockRequest = (options = {}) => ({
  user: options.user || null,
  body: options.body || {},
  params: options.params || {},
  query: options.query || {},
});

// Test data
let testUser;
let testUser2;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear collections
  await Task.deleteMany({});
  await User.deleteMany({});

  // Create test users
  testUser = await User.create({
    name: "Test User",
    email: "test@example.com",
    password: "password123",
    authProvider: "local",
  });

  testUser2 = await User.create({
    name: "Test User 2",
    email: "test2@example.com",
    password: "password123",
    authProvider: "local",
  });
});

// ============================================
// getAllTasks Tests
// ============================================
describe("getAllTasks", () => {
  describe("Guest Mode", () => {
    it("should return empty array for guest mode (no user)", async () => {
      const req = mockRequest({ user: null });
      const res = mockResponse();

      await getAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        tasks: [],
        pendingTasksCount: 0,
        completedTasksCount: 0,
        inProcessTasksCount: 0,
        cancelledTasksCount: 0,
        highPriorityCount: 0,
        mediumPriorityCount: 0,
        lowPriorityCount: 0,
        isGuest: true,
      });
    });
  });

  describe("Authenticated User", () => {
    it("should return tasks for authenticated user", async () => {
      // Create tasks for test user
      await Task.create([
        { title: "Task 1", userId: testUser._id, status: "pending", priority: "high" },
        { title: "Task 2", userId: testUser._id, status: "completed", priority: "low" },
      ]);

      const req = mockRequest({ user: testUser, query: { filter: "all" } });
      const res = mockResponse();

      await getAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.tasks).toHaveLength(2);
      expect(response.pendingTasksCount).toBe(1);
      expect(response.completedTasksCount).toBe(1);
    });

    it("should only return user's own tasks (not other users)", async () => {
      // Create tasks for different users
      await Task.create([
        { title: "User1 Task", userId: testUser._id },
        { title: "User2 Task", userId: testUser2._id },
      ]);

      const req = mockRequest({ user: testUser, query: { filter: "all" } });
      const res = mockResponse();

      await getAllTasks(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.tasks).toHaveLength(1);
      expect(response.tasks[0].title).toBe("User1 Task");
    });

    it("should return correct status counts", async () => {
      await Task.create([
        { title: "T1", userId: testUser._id, status: "pending" },
        { title: "T2", userId: testUser._id, status: "pending" },
        { title: "T3", userId: testUser._id, status: "completed" },
        { title: "T4", userId: testUser._id, status: "in-progress" },
        { title: "T5", userId: testUser._id, status: "cancelled" },
      ]);

      const req = mockRequest({ user: testUser, query: { filter: "all" } });
      const res = mockResponse();

      await getAllTasks(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.pendingTasksCount).toBe(2);
      expect(response.completedTasksCount).toBe(1);
      expect(response.inProcessTasksCount).toBe(1);
      expect(response.cancelledTasksCount).toBe(1);
    });

    it("should return correct priority counts", async () => {
      await Task.create([
        { title: "T1", userId: testUser._id, priority: "high" },
        { title: "T2", userId: testUser._id, priority: "high" },
        { title: "T3", userId: testUser._id, priority: "medium" },
        { title: "T4", userId: testUser._id, priority: "low" },
      ]);

      const req = mockRequest({ user: testUser, query: { filter: "all" } });
      const res = mockResponse();

      await getAllTasks(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.highPriorityCount).toBe(2);
      expect(response.mediumPriorityCount).toBe(1);
      expect(response.lowPriorityCount).toBe(1);
    });
  });

  describe("Date Filters", () => {
    it("should filter tasks by today", async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0); // Set to start of yesterday

      // Create task today
      await Task.create({ title: "Today Task", userId: testUser._id });
      
      // Create task yesterday using insertMany to bypass timestamps
      await Task.collection.insertOne({
        title: "Old Task",
        userId: testUser._id,
        status: "pending",
        priority: "medium",
        createdAt: yesterday,
        updatedAt: yesterday
      });

      const req = mockRequest({ user: testUser, query: { filter: "today" } });
      const res = mockResponse();

      await getAllTasks(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.tasks).toHaveLength(1);
      expect(response.tasks[0].title).toBe("Today Task");
    });

    it("should return all tasks when filter is 'all'", async () => {
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);

      await Task.create({ title: "New Task", userId: testUser._id });
      const oldTask = await Task.create({ title: "Old Task", userId: testUser._id });
      await Task.updateOne({ _id: oldTask._id }, { $set: { createdAt: lastYear } });

      const req = mockRequest({ user: testUser, query: { filter: "all" } });
      const res = mockResponse();

      await getAllTasks(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.tasks).toHaveLength(2);
    });

    it("should default to today filter when no filter specified", async () => {
      const req = mockRequest({ user: testUser, query: {} });
      const res = mockResponse();

      await Task.create({ title: "Today Task", userId: testUser._id });

      await getAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      const req = mockRequest({ user: testUser, query: { filter: "all" } });
      const res = mockResponse();

      // Mock aggregate to throw error
      const originalAggregate = Task.aggregate;
      Task.aggregate = jest.fn().mockRejectedValue(new Error("DB Error"));

      await getAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Lỗi hệ thống" });

      // Restore
      Task.aggregate = originalAggregate;
    });
  });
});

// ============================================
// createTask Tests
// ============================================
describe("createTask", () => {
  describe("Guest Mode", () => {
    it("should reject guest mode with 401", async () => {
      const req = mockRequest({
        user: null,
        body: { title: "New Task" },
      });
      const res = mockResponse();

      await createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Vui lòng đăng nhập để lưu task",
        isGuest: true,
      });
    });
  });

  describe("Authenticated User", () => {
    it("should create task with valid data", async () => {
      const req = mockRequest({
        user: testUser,
        body: {
          title: "New Task",
          description: "Task description",
          status: "pending",
          priority: "high",
        },
      });
      const res = mockResponse();

      await createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const createdTask = res.json.mock.calls[0][0];
      expect(createdTask.title).toBe("New Task");
      expect(createdTask.description).toBe("Task description");
      expect(createdTask.priority).toBe("high");
    });

    it("should create task with minimal fields (title only)", async () => {
      const req = mockRequest({
        user: testUser,
        body: { title: "Minimal Task" },
      });
      const res = mockResponse();

      await createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const createdTask = res.json.mock.calls[0][0];
      expect(createdTask.title).toBe("Minimal Task");
      expect(createdTask.status).toBe("pending"); // default
      expect(createdTask.priority).toBe("medium"); // default
    });

    it("should associate task with correct user", async () => {
      const req = mockRequest({
        user: testUser,
        body: { title: "User Task" },
      });
      const res = mockResponse();

      await createTask(req, res);

      const createdTask = res.json.mock.calls[0][0];
      expect(createdTask.userId.toString()).toBe(testUser._id.toString());
    });

    it("should create task with all fields including dates", async () => {
      const req = mockRequest({
        user: testUser,
        body: {
          title: "Complete Task",
          description: "Full description",
          status: "in-progress",
          priority: "low",
        },
      });
      const res = mockResponse();

      await createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const createdTask = res.json.mock.calls[0][0];
      expect(createdTask.title).toBe("Complete Task");
      expect(createdTask.description).toBe("Full description");
      expect(createdTask.status).toBe("in-progress");
      expect(createdTask.priority).toBe("low");
      expect(createdTask.createdAt).toBeDefined();
      expect(createdTask.updatedAt).toBeDefined();
    });
  });

  describe("Validation", () => {
    it("should fail when title is missing", async () => {
      const req = mockRequest({
        user: testUser,
        body: { description: "No title" },
      });
      const res = mockResponse();

      await createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      const req = mockRequest({
        user: testUser,
        body: { title: "Task" },
      });
      const res = mockResponse();

      // Mock save to throw error
      const originalSave = Task.prototype.save;
      Task.prototype.save = jest.fn().mockRejectedValue(new Error("DB Error"));

      await createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Lỗi hệ thống" });

      // Restore
      Task.prototype.save = originalSave;
    });
  });
});

// ============================================
// updateTask Tests
// ============================================
describe("updateTask", () => {
  let existingTask;

  beforeEach(async () => {
    existingTask = await Task.create({
      title: "Original Title",
      description: "Original Description",
      status: "pending",
      priority: "medium",
      userId: testUser._id,
    });
  });

  describe("Guest Mode", () => {
    it("should reject guest mode with 401", async () => {
      const req = mockRequest({
        user: null,
        params: { id: existingTask._id },
        body: { title: "Updated" },
      });
      const res = mockResponse();

      await updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Vui lòng đăng nhập để cập nhật task",
        isGuest: true,
      });
    });
  });

  describe("Authenticated User", () => {
    it("should update task successfully", async () => {
      const req = mockRequest({
        user: testUser,
        params: { id: existingTask._id },
        body: {
          title: "Updated Title",
          status: "completed",
        },
      });
      const res = mockResponse();

      await updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const updatedTask = res.json.mock.calls[0][0];
      expect(updatedTask.title).toBe("Updated Title");
      expect(updatedTask.status).toBe("completed");
    });

    it("should update partial fields only", async () => {
      const req = mockRequest({
        user: testUser,
        params: { id: existingTask._id },
        body: { priority: "high" },
      });
      const res = mockResponse();

      await updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const updatedTask = res.json.mock.calls[0][0];
      expect(updatedTask.priority).toBe("high");
      expect(updatedTask.title).toBe("Original Title"); // unchanged
    });

    it("should update completedAt when task is completed", async () => {
      const completedAt = new Date();
      const req = mockRequest({
        user: testUser,
        params: { id: existingTask._id },
        body: {
          status: "completed",
          completedAt: completedAt,
        },
      });
      const res = mockResponse();

      await updateTask(req, res);

      const updatedTask = res.json.mock.calls[0][0];
      expect(updatedTask.completedAt).toBeDefined();
    });
  });

  describe("Authorization", () => {
    it("should return 404 for non-existent task", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const req = mockRequest({
        user: testUser,
        params: { id: fakeId },
        body: { title: "Updated" },
      });
      const res = mockResponse();

      await updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Nhiệm vụ không tồn tại hoặc bạn không có quyền",
      });
    });

    it("should not allow updating another user's task", async () => {
      const req = mockRequest({
        user: testUser2, // Different user
        params: { id: existingTask._id },
        body: { title: "Hacked!" },
      });
      const res = mockResponse();

      await updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      // Verify task was not updated
      const task = await Task.findById(existingTask._id);
      expect(task.title).toBe("Original Title");
    });
  });

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      const req = mockRequest({
        user: testUser,
        params: { id: existingTask._id },
        body: { title: "Updated" },
      });
      const res = mockResponse();

      const originalFindOneAndUpdate = Task.findOneAndUpdate;
      Task.findOneAndUpdate = jest.fn().mockRejectedValue(new Error("DB Error"));

      await updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Lỗi hệ thống" });

      Task.findOneAndUpdate = originalFindOneAndUpdate;
    });
  });
});

// ============================================
// deleteTask Tests
// ============================================
describe("deleteTask", () => {
  let existingTask;

  beforeEach(async () => {
    existingTask = await Task.create({
      title: "Task to Delete",
      userId: testUser._id,
    });
  });

  describe("Guest Mode", () => {
    it("should reject guest mode with 401", async () => {
      const req = mockRequest({
        user: null,
        params: { id: existingTask._id },
      });
      const res = mockResponse();

      await deleteTask(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Vui lòng đăng nhập để xóa task",
        isGuest: true,
      });
    });
  });

  describe("Authenticated User", () => {
    it("should delete task successfully", async () => {
      const req = mockRequest({
        user: testUser,
        params: { id: existingTask._id },
      });
      const res = mockResponse();

      await deleteTask(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Xóa nhiệm vụ thành công",
      });

      // Verify task was actually deleted
      const task = await Task.findById(existingTask._id);
      expect(task).toBeNull();
    });
  });

  describe("Authorization", () => {
    it("should return 404 for non-existent task", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const req = mockRequest({
        user: testUser,
        params: { id: fakeId },
      });
      const res = mockResponse();

      await deleteTask(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Nhiệm vụ không tồn tại hoặc bạn không có quyền",
      });
    });

    it("should not allow deleting another user's task", async () => {
      const req = mockRequest({
        user: testUser2, // Different user
        params: { id: existingTask._id },
      });
      const res = mockResponse();

      await deleteTask(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      // Verify task still exists
      const task = await Task.findById(existingTask._id);
      expect(task).not.toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      const req = mockRequest({
        user: testUser,
        params: { id: existingTask._id },
      });
      const res = mockResponse();

      const originalFindOneAndDelete = Task.findOneAndDelete;
      Task.findOneAndDelete = jest.fn().mockRejectedValue(new Error("DB Error"));

      await deleteTask(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Lỗi hệ thống" });

      Task.findOneAndDelete = originalFindOneAndDelete;
    });
  });
});
