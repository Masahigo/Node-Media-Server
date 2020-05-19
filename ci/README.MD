# Instructions for CI

You can setup your own custom rtmp to run in ACI using the script and templates found in this folder.

**Prerequisites**

- Azure CLI
- Azure Subscription and Owner role to it
- Permissions to create Service Principals to the Azure AD tenant

## Creating supporting resources for hosting the app in Azure Container Instance

The script `create-aci-resources.sh` provisions following Azure resources

- _Azure Storage account with file share_: used for ACI's volume share
- _Log Analytics Workspace_: for collecting ACI's diagnostics logs
- _Azure AD App Registration (SPN)_: for the app (Node media server) to write to blob storage

```bash

# Login to Azure
az login

# Select the subscription where resources are provisioned
# https://docs.microsoft.com/en-us/cli/azure/manage-azure-subscriptions-azure-cli
az account set -s <subscription id>

# Ensure the bash script can be executed
chmod +x ./create-aci-resources.sh

# Call the script, passing in your own params
RESOURCE_GROUP_NAME=<resource group name, eg. custom-rtmp-app-$(whoami)-rg>
STORAGE_ACCOUNT_NAME=<storage account name, eg. customrtmp$(whoami)westor>
LOCATION_NAME=<location name, eg westeurope>
LOG_ANALYTICS_WORKSPACE_NAME=<log analytics workspace name, eg. custom-rtmp-app-$(whoami)-law>

/bin/bash ./create-aci-resources.sh $RESOURCE_GROUP_NAME $STORAGE_ACCOUNT_NAME $LOCATION_NAME $LOG_ANALYTICS_WORKSPACE_NAME

# Take note of the output values, as you need to configure those to YAML file next

```

## Configuring your specific values to ACI config file and deploying to Azure

### Edit YAML file

Edit the ACI's configuration file `node-media-server.yaml` and replace all the values encapsulated with `<..>` with yours. The values are printed out from `create-aci-resources.sh` script.

### Deploy ACI

```bash

# Use the resource group name stored in env variable in previous step
az container create --resource-group $RESOURCE_GROUP_NAME -f node-media-server.yaml

# Get the ACI's url after deployment
az container show -g $RESOURCE_GROUP_NAME -n node-media-server --query ipAddress

# See LA Logs for ACI
# https://docs.microsoft.com/en-us/azure/container-instances/container-instances-log-analytics#view-logs
# https://docs.microsoft.com/en-us/azure/azure-monitor/log-query/examples

```
