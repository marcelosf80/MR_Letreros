import urllib.request
import tarfile
import os

url = "https://files.pythonhosted.org/packages/86/41/00a6b000f222f0fa4c6d9e1d6dcc9811a374cabb8abb9d408b77de39648c/basicsr-1.4.2.tar.gz"
dest = "basicsr-1.4.2.tar.gz"

print("Downloading basicsr...")
urllib.request.urlretrieve(url, dest)

print("Extracting...")
with tarfile.open(dest, "r:gz") as tar:
    tar.extractall()

print("Done!")
