import boto3
import json
import os
from dotenv import load_dotenv
 
def invoke_llama3_model(prompt: str):
    load_dotenv()
    aws_region = os.getenv("AWS_REGION")
    if not aws_region:
        raise ValueError("AWS_REGION is not set in your .env file.")
 
    print(f"Connecting to Bedrock in region: {aws_region}...")
 
    try:
        bedrock_runtime_client = boto3.client(
            service_name="bedrock-runtime",
            region_name=aws_region
        )
 
        model_id = "meta.llama3-70b-instruct-v1:0"
 
        request_body = json.dumps({
            "prompt": prompt,
            "max_gen_len": 512,
            "temperature": 0.7,
            "top_p": 0.9,
        })
 
        print(f"Invoking model: {model_id}...")
        response = bedrock_runtime_client.invoke_model(
            body=request_body,
            modelId=model_id,
            accept="application/json",
            contentType="application/json"
        )
 
        response_body = json.loads(response.get("body").read())
        generated_text = response_body.get("generation")
        return generated_text
 
    except Exception as e:
        print(f"❌ An error occurred while invoking the model: {e}")
        return None
 
 