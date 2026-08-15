import pandas as pd
import os
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
df = pd.read_csv(f"{base}\\indian_roads_dataset.csv")
print("Indian dataset rows:", len(df))
print("Lat range:", df["latitude"].min(), "to", df["latitude"].max())
print("Lng range:", df["longitude"].min(), "to", df["longitude"].max())
print()
df2 = pd.read_csv(f"{base}\\processed_real_data.csv")
print("UK dataset rows:", len(df2))
print("Lat range:", df2["latitude"].min(), "to", df2["latitude"].max())
print("Lng range:", df2["longitude"].min(), "to", df2["longitude"].max())
