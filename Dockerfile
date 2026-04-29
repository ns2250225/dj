# 使用官方 Python 轻量级镜像
FROM python:3.10-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量，防止 Python 生成 .pyc 文件，并强制无缓冲输出
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# pip 国内源（可在构建时通过 --build-arg 覆盖）
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ENV PIP_INDEX_URL=${PIP_INDEX_URL}
ENV PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# apt 国内源（可在构建时通过 --build-arg 覆盖）
ARG APT_MIRROR=mirrors.tuna.tsinghua.edu.cn

# 安装系统依赖（如果有些包需要编译）
RUN if [ -f /etc/apt/sources.list ]; then \
        sed -i "s|http://deb.debian.org/debian|https://${APT_MIRROR}/debian|g; s|https://deb.debian.org/debian|https://${APT_MIRROR}/debian|g; s|http://security.debian.org/debian-security|https://${APT_MIRROR}/debian-security|g; s|https://security.debian.org/debian-security|https://${APT_MIRROR}/debian-security|g" /etc/apt/sources.list; \
    fi; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i "s|http://deb.debian.org/debian|https://${APT_MIRROR}/debian|g; s|https://deb.debian.org/debian|https://${APT_MIRROR}/debian|g; s|http://security.debian.org/debian-security|https://${APT_MIRROR}/debian-security|g; s|https://security.debian.org/debian-security|https://${APT_MIRROR}/debian-security|g" /etc/apt/sources.list.d/debian.sources; \
    fi \
    && apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

# 复制 requirements 文件并安装 Python 依赖
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# 复制项目所有文件到工作目录
COPY . /app/

# 确保静态文件和音频目录存在
RUN mkdir -p static/css static/js static/audio

# 暴露 FastAPI 默认端口
EXPOSE 8000

# 启动 FastAPI 应用
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
