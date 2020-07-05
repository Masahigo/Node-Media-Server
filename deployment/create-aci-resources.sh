#!/bin/bash

set -e

# https://docs.microsoft.com/en-us/azure/container-instances/container-instances-volume-azure-files#create-an-azure-file-share
ACI_PERS_RESOURCE_GROUP=$1
ACI_PERS_STORAGE_ACCOUNT_NAME=$2
ACI_PERS_LOCATION=$3
ACI_LOG_ANALYTICS_WORKSPACE_NAME=$4
ACI_PERS_SHARE_NAME=acishare

az group create -n $ACI_PERS_RESOURCE_GROUP -l $ACI_PERS_LOCATION --tags application="Custom rtmp stream"

# Create the storage account with the parameters
az storage account create \
    --resource-group $ACI_PERS_RESOURCE_GROUP \
    --name $ACI_PERS_STORAGE_ACCOUNT_NAME \
    --location $ACI_PERS_LOCATION \
    --sku Standard_LRS

# Create the file share
az storage share create \
  --name $ACI_PERS_SHARE_NAME \
  --account-name $ACI_PERS_STORAGE_ACCOUNT_NAME

echo "<Storage account name>: $ACI_PERS_STORAGE_ACCOUNT_NAME"
STORAGE_KEY=$(az storage account keys list --resource-group $ACI_PERS_RESOURCE_GROUP --account-name $ACI_PERS_STORAGE_ACCOUNT_NAME --query "[0].value" --output tsv)
echo "<Storage account key>: $STORAGE_KEY"

timestamp=$(date '+%Y-%m-%d-%H-%M')
az group deployment create --resource-group $ACI_PERS_RESOURCE_GROUP --name acilawdeployment-$timestamp --template-file deploylaworkspacetemplate.json --parameters workspaceName=$ACI_LOG_ANALYTICS_WORKSPACE_NAME

LAW_ID=$(az resource show --resource-group $ACI_PERS_RESOURCE_GROUP --resource-type Microsoft.OperationalInsights/workspaces --name $ACI_LOG_ANALYTICS_WORKSPACE_NAME --query properties.customerId -o tsv)
echo "Log Analytics Workspace ID: $LAW_ID"
LAW_KEY=$(az monitor log-analytics workspace get-shared-keys --resource-group custom-rtmp-malmi-we-rg --workspace-name $ACI_LOG_ANALYTICS_WORKSPACE_NAME --query primarySharedKey -o tsv)
echo "Log Analytics Workspace Key: $LAW_KEY"

SUB_ID=$(az account show --query id -o tsv)

echo "Creating AAD App for ACI to access blob storage.."

create_new_app(){
    if [ `az ad app list --display-name $1 | jq -r '.[] | length'` > 1 ]; then
        echo "${1} exists. Skipping.."
    else
        echo "${1} does not exist, creating ${1}.."
        echo "Create AAD App registration"
        az ad app create --display-name $1 --homepage "http://localhost/$1" --identifier-uris "http://localhost/$1" --password $5 --output none
        APP_ID=$(az ad app list --display-name ${1} --query [0].appId -o tsv)
        
        echo "Apply needed API permissions"
        
        # Azure Storage - user_impersonation - Delegated - Access Azure Storage
        echo "-- Azure Storage --"
        az ad app permission add --id $APP_ID --api e406a681-f3d4-42a8-90b6-c2b029497af1 --api-permissions 03e0da56-190b-40ad-a80c-ea378c433f7f=Scope

        # Graph API - User.Read - Delegated - Sign in and read profile
        echo "-- Graph API --"
        az ad app permission add --id $APP_ID --api 00000003-0000-0000-c000-000000000000 --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope

        echo "Create SPN"
        az ad sp create-for-rbac --name $APP_ID --role "Storage Blob Data Contributor" --scopes /subscriptions/$2/resourceGroups/$3/providers/Microsoft.Storage/storageAccounts/$4
        SP_APP_ID=$(az ad sp list --spn http://$APP_ID --query [0].appId -o tsv)

        echo "Grant delegated permissions"
        az ad app permission grant --id $SP_APP_ID --api e406a681-f3d4-42a8-90b6-c2b029497af1 --output none
        az ad app permission grant --id $SP_APP_ID --api 00000003-0000-0000-c000-000000000000 --output none
        echo "Done!"
    fi
}

# Use year and current month as guid
guid=$(date '+%Y-%m')

APP_PWD=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 13 ; echo '')
APP_NAME="custom-rtmp-app-$guid"
echo "Creating app (SPN) for $APP_NAME with password $APP_PWD.."
create_new_app $APP_NAME $SUB_ID $ACI_PERS_RESOURCE_GROUP $ACI_PERS_STORAGE_ACCOUNT_NAME $APP_PWD
