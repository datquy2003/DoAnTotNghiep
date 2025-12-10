import express from "express";
import sql from "mssql";
import { sqlConfig } from "../config/db.js";
import { checkAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

const checkAdminRole = async (req, res, next) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool
      .request()
      .input("FirebaseUserID", sql.NVarChar, req.firebaseUser.uid)
      .query("SELECT RoleID FROM Users WHERE FirebaseUserID = @FirebaseUserID");

    const roleID = result.recordset[0]?.RoleID;
    if (roleID === 1 || roleID === 2) {
      next();
    } else {
      return res.status(403).json({ message: "Quyền truy cập bị từ chối." });
    }
  } catch (error) {
    return res.status(500).json({ message: "Lỗi kiểm tra quyền." });
  }
};

router.get("/", async (req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool
      .request()
      .query("SELECT * FROM Categories ORDER BY CategoryName ASC");
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách danh mục." });
  }
});

router.get("/specializations-all", async (_req, res) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool
      .request()
      .query(
        "SELECT SpecializationID, SpecializationName, CategoryID FROM Specializations ORDER BY SpecializationName ASC"
      );
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách chuyên môn." });
  }
});

router.post("/", checkAuth, checkAdminRole, async (req, res) => {
  const { CategoryName } = req.body;
  if (!CategoryName)
    return res
      .status(400)
      .json({ message: "Tên danh mục không được để trống." });

  try {
    const pool = await sql.connect(sqlConfig);
    await pool
      .request()
      .input("CategoryName", sql.NVarChar, CategoryName)
      .query("INSERT INTO Categories (CategoryName) VALUES (@CategoryName)");
    res.status(201).json({ message: "Thêm danh mục thành công." });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi thêm danh mục." });
  }
});

router.delete("/:id", checkAuth, checkAdminRole, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql.connect(sqlConfig);

    const checkUsage = await pool.request().input("CategoryID", sql.Int, id)
      .query(`
        SELECT TOP 1 1 
        FROM Jobs 
        WHERE CategoryID = @CategoryID
      `);

    if (checkUsage.recordset.length > 0) {
      return res.status(400).json({
        message:
          "Không thể xóa danh mục này vì đang có bài tuyển dụng thuộc danh mục này.",
      });
    }

    await pool
      .request()
      .input("CategoryID", sql.Int, id)
      .query("DELETE FROM Categories WHERE CategoryID = @CategoryID");

    res.status(200).json({ message: "Xóa danh mục thành công." });
  } catch (error) {
    console.error("Lỗi xóa category:", error);
    if (error.number === 547) {
      return res.status(400).json({
        message: "Không thể xóa vì dữ liệu đang được sử dụng ở nơi khác.",
      });
    }
    res.status(500).json({ message: "Lỗi khi xóa danh mục." });
  }
});

router.put("/:id", checkAuth, checkAdminRole, async (req, res) => {
  const { id } = req.params;
  const { CategoryName } = req.body;
  try {
    const pool = await sql.connect(sqlConfig);
    await pool
      .request()
      .input("CategoryID", sql.Int, id)
      .input("CategoryName", sql.NVarChar, CategoryName)
      .query(
        "UPDATE Categories SET CategoryName = @CategoryName WHERE CategoryID = @CategoryID"
      );
    res.status(200).json({ message: "Cập nhật thành công." });
  } catch (error) {
    res.status(500).json({ message: "Lỗi cập nhật." });
  }
});

router.get("/:categoryId/specializations", async (req, res) => {
  const { categoryId } = req.params;
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool
      .request()
      .input("CategoryID", sql.Int, categoryId)
      .query(
        "SELECT * FROM Specializations WHERE CategoryID = @CategoryID ORDER BY SpecializationName ASC"
      );
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách chuyên môn." });
  }
});

router.post("/specializations", checkAuth, checkAdminRole, async (req, res) => {
  const { CategoryID, SpecializationName } = req.body;
  if (!CategoryID || !SpecializationName)
    return res.status(400).json({ message: "Thiếu thông tin." });

  try {
    const pool = await sql.connect(sqlConfig);
    await pool
      .request()
      .input("CategoryID", sql.Int, CategoryID)
      .input("SpecializationName", sql.NVarChar, SpecializationName)
      .query(
        "INSERT INTO Specializations (CategoryID, SpecializationName) VALUES (@CategoryID, @SpecializationName)"
      );
    res.status(201).json({ message: "Thêm chuyên môn thành công." });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi thêm chuyên môn." });
  }
});

router.delete(
  "/specializations/:id",
  checkAuth,
  checkAdminRole,
  async (req, res) => {
    const { id } = req.params;
    try {
      const pool = await sql.connect(sqlConfig);

      const checkUsage = await pool
        .request()
        .input("SpecializationID", sql.Int, id)
        .query(
          "SELECT TOP 1 1 FROM Jobs WHERE SpecializationID = @SpecializationID"
        );

      if (checkUsage.recordset.length > 0) {
        return res.status(400).json({
          message:
            "Không thể xóa chuyên môn này vì đang có bài tuyển dụng sử dụng nó.",
        });
      }

      await pool
        .request()
        .input("SpecializationID", sql.Int, id)
        .query(
          "DELETE FROM Specializations WHERE SpecializationID = @SpecializationID"
        );

      res.status(200).json({ message: "Xóa chuyên môn thành công." });
    } catch (error) {
      console.error("Lỗi xóa spec:", error);
      if (error.number === 547) {
        return res.status(400).json({
          message:
            "Không thể xóa vì dữ liệu đang được sử dụng ở nơi khác (Ví dụ: Hồ sơ ứng viên).",
        });
      }
      res.status(500).json({ message: "Lỗi khi xóa chuyên môn." });
    }
  }
);

router.put(
  "/specializations/:id",
  checkAuth,
  checkAdminRole,
  async (req, res) => {
    const { id } = req.params;
    const { SpecializationName } = req.body;
    try {
      const pool = await sql.connect(sqlConfig);
      await pool
        .request()
        .input("SpecializationID", sql.Int, id)
        .input("SpecializationName", sql.NVarChar, SpecializationName)
        .query(
          "UPDATE Specializations SET SpecializationName = @SpecializationName WHERE SpecializationID = @SpecializationID"
        );
      res.status(200).json({ message: "Cập nhật thành công." });
    } catch (error) {
      res.status(500).json({ message: "Lỗi cập nhật." });
    }
  }
);

export default router;