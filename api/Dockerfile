FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY BuildMate.sln ./
COPY src/BuildMate.Domain/*.csproj src/BuildMate.Domain/
COPY src/BuildMate.Data/*.csproj src/BuildMate.Data/
COPY src/BuildMate.Services/*.csproj src/BuildMate.Services/
COPY src/BuildMate.Api/*.csproj src/BuildMate.Api/
RUN dotnet restore src/BuildMate.Api/BuildMate.Api.csproj
COPY src/ src/
RUN dotnet publish src/BuildMate.Api/BuildMate.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 TZ=Asia/Kolkata
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*
COPY --from=build /app .
RUN mkdir -p /app/storage && chown -R app:app /app/storage
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "BuildMate.Api.dll"]
