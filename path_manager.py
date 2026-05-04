"""
统一路径管理模块
解决打包后路径问题的终极方案
"""
import os
import sys


class PathManager:
    """统一路径管理器 - 所有文件路径都通过此类获取"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # 判断是否在打包环境中
        self.frozen = getattr(sys, 'frozen', False)
        
        # 获取基础路径
        if self.frozen:
            # 打包后：使用可执行文件所在目录
            self.base_path = os.path.dirname(sys.executable)
            print(f"[PATH] Running in frozen mode")
            print(f"[PATH]Executable: {sys.executable}")
            print(f"[PATH]Base path: {self.base_path}")
        else:
            # 开发环境：使用 main.py 所在目录
            self.base_path = os.path.dirname(os.path.abspath(__file__))
            print(f"[PATH] Running in development mode")
            print(f"[PATH]Script path: {os.path.abspath(__file__)}")
            print(f"[PATH]Base path: {self.base_path}")
        
        # 定义所有关键路径（都使用绝对路径）
        if self.frozen:
            # 打包后：所有路径都在 EXE 同级目录
            self.db_path = os.path.join(self.base_path, "finance_data.db")
            self.backup_path = os.path.join(self.base_path, "finance_data_backup.db")
            self.backups_dir = os.path.join(self.base_path, "backups")
            self.static_dir = "dist"  # Flask 使用相对路径
            self.static_dir_runtime = os.path.join(self.base_path, "dist")
            self.static_dir_in_exe = os.path.join(sys._MEIPASS, "dist")
        else:
            # 开发环境：使用相对路径
            self.db_path = os.path.join(self.base_path, "finance_data.db")
            self.backup_path = os.path.join(self.base_path, "finance_data_backup.db")
            self.backups_dir = os.path.join(self.base_path, "backups")
            self.static_dir = "dist"
            self.static_dir_runtime = os.path.join(self.base_path, "dist")
            self.static_dir_in_exe = self.static_dir
        
        # 确保目录存在
        os.makedirs(self.backups_dir, exist_ok=True)
        
        # 打印所有路径（调试用）
        print(f"\n[PATH] All paths initialized:")
        print(f"[PATH]   Database:         {self.db_path}")
        print(f"[PATH]   Backup DB:        {self.backup_path}")
        print(f"[PATH]   Backups Dir:      {self.backups_dir}")
        print(f"[PATH]   Static Dir:       {self.static_dir}")
        print(f"[PATH]   Static Runtime:   {self.static_dir_runtime}")
        if self.frozen:
            print(f"[PATH]   Static (MEI):     {self.static_dir_in_exe}")
        print()
        
        self._initialized = True
    
    def get_db_path(self):
        """获取数据库文件路径"""
        return self.db_path
    
    def get_backup_db_path(self):
        """获取备份数据库路径"""
        return self.backup_path
    
    def get_backups_dir(self):
        """获取备份目录路径"""
        return self.backups_dir
    
    def get_static_dir(self):
        """获取静态文件目录（用于 Flask static_folder）"""
        return self.static_dir
    
    def get_static_dir_in_exe(self):
        """获取打包后的静态文件目录（sys._MEIPASS）"""
        return self.static_dir_in_exe
    
    def get_static_dir_runtime(self):
        """获取运行时静态文件目录（用于写入操作）"""
        return self.static_dir_runtime
    
    def get_backup_folder_path(self, folder_name):
        """获取备份子目录路径"""
        return os.path.join(self.backups_dir, folder_name)
    
    def get_temp_restore_dir(self):
        """获取临时恢复目录"""
        return os.path.join(self.backups_dir, "restore_temp")
    
    def join(self, *paths):
        """通用路径拼接方法"""
        return os.path.join(self.base_path, *paths)


# 创建全局单例
path_manager = PathManager()


# 兼容旧代码的函数
def get_db_path():
    return path_manager.get_db_path()


def get_backup_db_path():
    return path_manager.get_backup_db_path()


def get_backups_dir():
    return path_manager.get_backups_dir()


def get_static_dir():
    return path_manager.get_static_dir()


def get_static_dir_in_exe():
    return path_manager.get_static_dir_in_exe()


# 测试
if __name__ == "__main__":
    print("Testing PathManager...")
    pm = PathManager()
    print(f"\nDB Path: {pm.get_db_path()}")
    print(f"Backup DB: {pm.get_backup_db_path()}")
    print(f"Backups Dir: {pm.get_backups_dir()}")
    print(f"Static Dir: {pm.get_static_dir()}")
    if pm.frozen:
        print(f"Static (MEI): {pm.get_static_dir_in_exe()}")
