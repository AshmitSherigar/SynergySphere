const express = require("express");
const { pool } = require("../db/db");
const { protect } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

// 🔹 Create a task (must be project member or owner)
router.post("/:projectId/tasks", protect, async (req, res) => {
  const { projectId } = req.params;
  const { title, description, status, due_date } = req.body;

  if (!title) return res.status(400).json({ message: "Task title is required" });

  try {
    // Check access (owner or member)
    const access = await pool.query(
      `
      SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2
      UNION
      SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2
      `,
      [projectId, req.user]
    );

    if (access.rows.length === 0) return res.status(403).json({ message: "No access to this project" });

    const result = await pool.query(
      `INSERT INTO tasks (project_id, title, description, status, due_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [projectId, title, description || null, status || "pending", due_date || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Error creating task", error: err.message });
  }
});

// 🔹 Get all tasks for a project
router.get("/:projectId/tasks", protect, async (req, res) => {
  const { projectId } = req.params;

  try {
    const access = await pool.query(
      `
      SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2
      UNION
      SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2
      `,
      [projectId, req.user]
    );

    if (access.rows.length === 0) return res.status(403).json({ message: "No access to this project" });

    const result = await pool.query(
      "SELECT * FROM tasks WHERE project_id=$1 ORDER BY created_at DESC",
      [projectId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Error fetching tasks", error: err.message });
  }
});

// 🔹 Update a task (must be project member/owner)
router.put("/tasks/:taskId", protect, async (req, res) => {
  const { taskId } = req.params;
  const { title, description, status, due_date } = req.body;

  try {
    // Find project_id for the task
    const taskCheck = await pool.query("SELECT project_id FROM tasks WHERE id=$1", [taskId]);
    if (taskCheck.rows.length === 0) return res.status(404).json({ message: "Task not found" });

    const projectId = taskCheck.rows[0].project_id;

    // Check access
    const access = await pool.query(
      `
      SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2
      UNION
      SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2
      `,
      [projectId, req.user]
    );
    if (access.rows.length === 0) return res.status(403).json({ message: "No access" });

    const result = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           due_date = COALESCE($4, due_date)
       WHERE id=$5 RETURNING *`,
      [title || null, description || null, status || null, due_date || null, taskId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Error updating task", error: err.message });
  }
});

// 🔹 Delete a task
router.delete("/tasks/:taskId", protect, async (req, res) => {
  const { taskId } = req.params;

  try {
    const taskCheck = await pool.query("SELECT project_id FROM tasks WHERE id=$1", [taskId]);
    if (taskCheck.rows.length === 0) return res.status(404).json({ message: "Task not found" });

    const projectId = taskCheck.rows[0].project_id;

    const access = await pool.query(
      `
      SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2
      UNION
      SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2
      `,
      [projectId, req.user]
    );
    if (access.rows.length === 0) return res.status(403).json({ message: "No access" });

    await pool.query("DELETE FROM tasks WHERE id=$1", [taskId]);
    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting task", error: err.message });
  }
});

module.exports = router;
